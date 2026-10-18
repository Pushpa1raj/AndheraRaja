#!/usr/bin/env bash
set -euo pipefail

# Configuration
REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || echo 'us-east-1')}"
KEY_NAME="andhera-raja-key"
KEY_FILE="deploy/aws-ec2/${KEY_NAME}.pem"
SG_NAME="andhera-raja-backend-sg"
INSTANCE_TYPE="t3.micro"
TAG_NAME="andhera-raja-backend"

echo "=== Deploying Andhera Raja Backend to AWS EC2 ==="
echo "Selected Region: ${REGION}"
echo "Instance Type:   ${INSTANCE_TYPE}"

# 1. Verify AWS Identity
echo "--> Checking AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "ERROR: AWS CLI session is expired or unauthenticated."
    echo "Please run: aws login"
    exit 1
fi

PROJECT_ID=$(aws sts get-caller-identity --query "Account" --output text)
echo "Connected to AWS Project: ${PROJECT_ID}"

# 2. Get Default VPC
echo "--> Fetching Default VPC..."
VPC_ID=$(aws ec2 describe-vpcs \
    --region "${REGION}" \
    --filters "Name=isDefault,Values=true" \
    --query "Vpcs[0].VpcId" \
    --output text)

if [ -z "${VPC_ID}" ] || [ "${VPC_ID}" = "None" ]; then
    echo "ERROR: No default VPC found in selected Region ${REGION}."
    exit 1
fi
echo "Using VPC: ${VPC_ID}"

# 3. Create or Get Security Group
echo "--> Checking Security Group..."
SG_ID=$(aws ec2 describe-security-groups \
    --region "${REGION}" \
    --filters "Name=group-name,Values=${SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query "SecurityGroups[0].GroupId" \
    --output text 2>/dev/null || true)

if [ -z "${SG_ID}" ] || [ "${SG_ID}" = "None" ]; then
    echo "Creating Security Group ${SG_NAME}..."
    SG_ID=$(aws ec2 create-security-group \
        --region "${REGION}" \
        --group-name "${SG_NAME}" \
        --description "Security group for Andhera Raja Backend (HTTP, HTTPS, SSH, WebSockets)" \
        --vpc-id "${VPC_ID}" \
        --query "GroupId" \
        --output text)

    # Inbound Rules
    aws ec2 authorize-security-group-ingress --region "${REGION}" --group-id "${SG_ID}" --protocol tcp --port 22 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --region "${REGION}" --group-id "${SG_ID}" --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --region "${REGION}" --group-id "${SG_ID}" --protocol tcp --port 443 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --region "${REGION}" --group-id "${SG_ID}" --protocol tcp --port 8000 --cidr 0.0.0.0/0
    echo "Security Group created: ${SG_ID}"
else
    echo "Existing Security Group found: ${SG_ID}"
fi

# 4. Key Pair
echo "--> Checking SSH Key Pair..."
mkdir -p deploy/aws-ec2
KEY_EXISTS=$(aws ec2 describe-key-pairs --region "${REGION}" --key-names "${KEY_NAME}" --query "KeyPairs[0].KeyName" --output text 2>/dev/null || true)

if [ "${KEY_EXISTS}" != "${KEY_NAME}" ]; then
    echo "Creating new SSH Key Pair: ${KEY_NAME}..."
    aws ec2 create-key-pair \
        --region "${REGION}" \
        --key-name "${KEY_NAME}" \
        --query "KeyMaterial" \
        --output text > "${KEY_FILE}"
    chmod 400 "${KEY_FILE}"
    echo "Saved SSH key to: ${KEY_FILE}"
else
    echo "Key Pair ${KEY_NAME} already exists in AWS."
fi

# 5. Fetch Latest Ubuntu 24.04 LTS AMI
echo "--> Finding latest Ubuntu 24.04 LTS AMI..."
AMI_ID=$(aws ec2 describe-images \
    --region "${REGION}" \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query "reverse(sort_by(Images, &CreationDate))[0].ImageId" \
    --output text)

echo "Using AMI: ${AMI_ID}"

# 6. Launch EC2 Instance
echo "--> Launching EC2 Instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --region "${REGION}" \
    --image-id "${AMI_ID}" \
    --count 1 \
    --instance-type "${INSTANCE_TYPE}" \
    --key-name "${KEY_NAME}" \
    --security-group-ids "${SG_ID}" \
    --user-data file://deploy/aws-ec2/user_data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${TAG_NAME}}]" \
    --query "Instances[0].InstanceId" \
    --output text)

echo "Instance launched: ${INSTANCE_ID}"
echo "Waiting for instance to enter running state..."
aws ec2 wait instance-running --region "${REGION}" --instance-ids "${INSTANCE_ID}"

PUBLIC_IP=$(aws ec2 describe-instances \
    --region "${REGION}" \
    --instance-ids "${INSTANCE_ID}" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text)

PUBLIC_DNS=$(aws ec2 describe-instances \
    --region "${REGION}" \
    --instance-ids "${INSTANCE_ID}" \
    --query "Reservations[0].Instances[0].PublicDnsName" \
    --output text)

echo ""
echo "============================================================"
echo "           AWS EC2 Backend Successfully Launched!           "
echo "============================================================"
echo "Instance ID:  ${INSTANCE_ID}"
echo "Public IP:    ${PUBLIC_IP}"
echo "Public DNS:   ${PUBLIC_DNS}"
echo ""
echo "API URL:      http://${PUBLIC_IP}"
echo "Swagger Docs: http://${PUBLIC_IP}/api/v1/docs"
echo "Health Check: http://${PUBLIC_IP}/health"
echo "WebSocket:    ws://${PUBLIC_IP}/api/v1/ws/{client_id}"
echo ""
echo "SSH Access:   ssh -i ${KEY_FILE} ubuntu@${PUBLIC_IP}"
echo "View Setup:   ssh -i ${KEY_FILE} ubuntu@${PUBLIC_IP} 'sudo cat /var/log/user-data.log'"
echo "============================================================"
