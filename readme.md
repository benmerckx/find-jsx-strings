# find-jsx-strings

Utility to find hardcoded strings in jsx/tsx files (so they can be replaced by translations).

## Usage

```sh
npx find-jsx-strings <dir> [opts]
```

## Example

```tsx
// index.tsx
export default function App() {
  return (
    <div>
      <h1>Hello</h1>
      <p>Start editing</p>
      <img alt="Some alt text" other={true} data-test />
    </div>
  )
}
```

```sh
npx find-jsx-strings .
```

Will report:

```
index.tsx:6
 6 │       <h1>Hello</h1>
   ·           ─────

index.tsx:7
 7 │       <p>Start editing</p>
   ·          ─────────────

index.tsx:8
 8 │       <img alt="Some alt text" other={true} data-test />
   ·                ───────────────
```

## Options

```
-A, --skip-attributes  Skip all string attributes or accepts comma separated list
--skip-text            Skip all JSX text
-P, --skip-pattern     Skip text or attributes that include this string
--skip-files           Skip all files that include these strings (comma separated list)
--include-literal      Include reporting string literals
--include-template     Include reporting template literals
-v, --version          Displays current version
-h, --help             Display help message
```
