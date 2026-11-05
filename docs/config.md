# Config

helix-cm6 reads the format of Helix's `config.toml`, so people can use their Helix config without changes.

## Load a config

Pass the text as `config`. Your app decides where the file lives:

```ts
const extension = helix({ config: await readFile("helix.toml") });
```

An object works too:

```ts
const extension = helix({ config: { editor: { scrolloff: 3 } } });
```

## Reload a config

`helixConfigure` replaces what you pass and keeps the rest. It returns the warnings:

```ts
const warnings = helixConfigure(view, { config: await readFile("helix.toml") });
```

It also takes `commands` and `keys`. A `null` config means the defaults.

## Find mistakes

An unknown option, a bad key or an unknown command gives a warning. The first one shows as a message.

```ts
for (const warning of helixConfigWarnings(view)) console.warn(warning);
```

## Read options

`helixConfig` gives every option, and follows `:set`:

```ts
const { rulers, scrolloff } = helixConfig(view);
```

Some options have no effect until your app draws them, such as `rulers` and `statusline`. helix-cm6 reads them and gives you the values. [parity.md](parity.md) marks these as `data`.

## Change the look

Options cover Helix's behavior. For colors, see [Colors](colors.md).
