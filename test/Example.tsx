import * as React from 'react'
import './style.css'

export default function App() {
  return (
    <div>
      <h1>Hello</h1>
      <p>Start editing</p>
      <>
        Some multiline
        <div />
        text
      </>
      <div dealWithUtf8="😍" attr="…" offset="here" />
      <button onClick={() => alert('Hello', `a ${'b'}`)}>Click me</button>
      <img alt="Some alt text" other={true} data-test />
    </div>
  )
}
