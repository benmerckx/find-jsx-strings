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
C:\Users\ben\projects\find_strings\test\Example.tsx:6
 6 │       <h1>Hello</h1>
   ·           ─────

C:\Users\ben\projects\find_strings\test\Example.tsx:7
 7 │       <p>Start editing</p>
   ·          ─────────────

C:\Users\ben\projects\find_strings\test\Example.tsx:8
 8 │       <img alt="Some alt text" other={true} data-test />
   ·
```

## Options

```
--skip-attributes    Skip string attributes
--skip-text          Skip JSX text
-v, --version        Displays current version
-h, --help           Display help message
```
