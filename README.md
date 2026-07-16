## What?

This project helps to upgrade deprecated Ready accounts (see the [Supported account versions table](#supported-account-versions-and-upgrade-methods)) to a version that can be used in the extension.

## Why old-account recovery still works

Starknet v0.14.0 rejects transaction versions 0, 1, and 2 at the sequencer gateway. It accepts only v3 transactions compatible with RPC 0.8 (including bounds for `l1_gas`, `l2_gas`, and `l1_data_gas`). Native v3 fees are paid in STRK; paying in another token requires an applicative paymaster.

This repository can nevertheless recover supported old accounts through two protocol compatibility mechanisms:

- **v1-bound account whitelist:** Certain legacy account class hashes can validate a v3 transaction as though it were a v1 transaction. The Ready/Argent v0.2.3.0 and v0.2.3.1 implementation class hashes are on this whitelist, so this tool can submit their direct upgrade as a v3 transaction.
- **`meta_tx_v0`:** The v0.14.0 `meta_tx_v0` syscall lets a helper contract execute a v0-signed `__execute__` payload inside a v3 transaction. The outer v3 transaction pays the STRK fee, while the old account validates the inner payload using its original v0 hashing and signature rules. This is the path used for v0.2.0–v0.2.2 accounts, which are v0-bound and do not have a `__validate__` entry point.

The `meta_tx_v0` recovery path is available only on mainnet; v0 transactions are disabled on the other networks. The whitelist is a compatibility measure, not a permanent substitute for upgrading.

See Starknet's [v0.14.0 deprecation guide](https://github.com/starknet-io/deprecation-guide) and [v0.14.0 pre-release notes](https://community.starknet.io/t/sn-0-14-0-pre-release-notes/115618) for protocol details.

## How?

Install pnpm <https://pnpm.io/installation>

Run

```bash
pnpm install
```

Create a file name `.env` following the example in `.env.example`. Make sure you fill ADDRESS with the address of the account to upgrade, and PRIVATE_KEY with the private key controling that account.

Otherwise you can run the user-input.sh script with the following command:

```bash
source scripts/user-input.sh
```

Then run

```bash
pnpm run upgrade
```

It will output a transaction hash. You can go to your block explorer to see if the transaction succeeds

## How Account Upgrades Work

This application helps upgrade old Ready account contracts to the latest version (v0.4.0). The upgrade process varies depending on the account version and proxy type.

### Supported Account Versions and Upgrade Methods

| Version  | Old Proxy                                             | New Proxy                                         | No Proxy                                       |
| -------- | ----------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| v0.2.0   | v0.2.3.1 via meta-tx-v0 (uses implementation address) | v0.2.3.1 via meta-tx-v0 (uses class hash)         | Not supported                                  |
| v0.2.1   | v0.2.3.1 via meta-tx-v0 (uses implementation address) | v0.2.3.1 via meta-tx-v0 (uses class hash)         | Not supported                                  |
| v0.2.2   | Not supported (1)                                     | v0.2.3.1 via meta-tx-v0 (uses class hash)         | Not supported                                  |
| v0.2.3.0 | v0.4.0 via direct transaction\* (uses class hash)     | v0.4.0 via direct transaction\* (uses class hash) | Not supported                                  |
| v0.2.3.1 | v0.4.0 via direct transaction\* (uses class hash)     | v0.4.0 via direct transaction\* (uses class hash) | Not supported                                  |
| v0.3.0   | Not supported (2)                                     | v0.4.0 via outside execution (uses class hash)    | v0.4.0 via outside execution (uses class hash) |
| v0.3.1   | Not supported (2)                                     | v0.4.0 via outside execution (uses class hash)    | v0.4.0 via outside execution (uses class hash) |

_\*: Upgrade from v2.3.x to v4.0.0 always contain data `[0x0]` to make sure that the proxy (old or new) is removed_

> (1): Old proxy is not compatible with account versions that do library calls.
> (2): With the existing contracts it is not possible to have a v0.3.x account with an old proxy.

### Upgrade Process

1. **Account Detection**: The application detects the current account version and proxy type by checking the class hash
2. **Verification**: Verifies that the provided private key matches the account owner and that no guardian is set
3. **Upgrade Execution**: Depending on the version and proxy type:
   - **Direct transactions**: For v0.2.3.x accounts, executes upgrade directly
   - **V0 Meta-transactions**: For v0.2.x accounts, uses a meta transaction contract to execute v0 transaction to upgrade
   - **Outside execution**: For v0.3.x accounts, uses outside execution calls that require manual execution

### Requirements

- Account must not have a guardian set
- Private key must match the account owner
- Sufficient STRK balance for transaction fees (where applicable)
