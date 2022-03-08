# Convert from v0 to v1

Running `index.js` will create a v1 state from a v0 `*.kana` file.

```sh
node --experimental-wasm-bulk-memory --experimental-wasm-threads index.js ../../v0/examples/zeisel_tenx_20220307.kana
```

The idea is that we can copy in `converter.js` into **kana** with no modification,
to convert existing v0 states into the appropriate v1 representation.
`index.js` contains functions that will remain in **kana** (after the transition to v1) and do not need to be copied.
