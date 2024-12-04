#!/bin/bash

# Prompt the user for their private key and wallet address
echo "Please enter your private key:"
read PRIVATE_KEY
echo "Please enter your wallet address:"
read WALLET_ADDRESS

# Save these values in a .env file
echo "RPC_URL=https://starknet-mainnet.public.blastapi.io" > .env
echo "PRIVATE_KEY=$PRIVATE_KEY" >> .env
echo "ADDRESS=$WALLET_ADDRESS" >> .env


echo "Your details have been saved in a .env file. Please delete the file after the upgrade"