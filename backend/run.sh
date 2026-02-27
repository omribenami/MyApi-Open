#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

# Generate .env if missing
if [ ! -f ".env" ]; then
    cp .env.example .env
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    VAULT_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    sed -i "s/change-me-to-a-random-256-bit-secret/$JWT_SECRET/" .env
    echo "VAULT_ENCRYPTION_KEY=$VAULT_KEY" >> .env
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 4501 --reload
