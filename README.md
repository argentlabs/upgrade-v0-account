# upgrade-script

To install dependencies:
Intall bun https://bun.sh/docs/installation

Run

```bash
bun install
```

Create a file name `.env` following the example in `.env.example`. Make sure you fill ADDRESS with the address of the account to upgrade, and PRIVATE_KEY with the private key controling that account

Then run

```bash
bun run upgrade
```

It will output a transaction hash. You can go to your block explorer to see if the transacction succeeds

NOTE: this script only works on mainnet, V0 transactions have been disabled on the other networks
