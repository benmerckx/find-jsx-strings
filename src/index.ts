#!/usr/bin/env node

import {JSXAttribute, JSXText, parse} from '@swc/core'
import sade from 'sade'
import {createRequire} from 'module'
import path from 'path'
import fs from 'fs/promises'
import {Visitor} from '@swc/core/Visitor.js'

type Options = {
  skipAttributes: boolean
  skipText: boolean
}

const version = createRequire(import.meta.url)('../package.json').version

sade('find_strings <src>', true)
  .version(version)
  .option('--skip-attributes', 'Skip string attributes')
  .option('--skip-text', 'Skip JSX text')
  .describe('Scan for hardcoded strings in JSX')
  .action(main)
  .parse(process.argv)

class StringVisitor extends Visitor {
  constructor(
    public sourceFile: string,
    public sourceContent: string,
    public options: Options
  ) {
    super()
  }
  report(start: number, end: number) {
    let lineNumber = 0,
      lineStart = 0,
      lineEnd
    for (let i = 0; i < this.sourceContent.length; i++)
      if (this.sourceContent[i] === '\n') {
        if (i < start) {
          lineNumber++
          lineStart = i + 1
        } else {
          lineEnd = i
          break
        }
      }
    const line = this.sourceContent.slice(lineStart, lineEnd)
    console.log(`\n\x1b[35m${this.sourceFile}:${lineNumber}\x1b[39m`)
    const pad = String(lineNumber).length
    const charIndex = start - lineStart
    const messageLength = end - start
    //console.log(' '.repeat(pad + 2) + `╭────`)
    console.log(` ${lineNumber} │ ${line}`)
    console.log(
      ' '.repeat(pad + 2) +
        `·` +
        ' '.repeat(charIndex) +
        '─'.repeat(messageLength)
    )
    //console.log(' '.repeat(pad + 2) + `╰────`)
  }
  visitJSXText(text: JSXText) {
    if (!this.options.skipText) {
      const isEmpty = text.value.trim() === ''
      if (!isEmpty) this.report(text.span.start, text.span.end)
    }
    return text
  }
  visitJSXAttribute(attr: JSXAttribute) {
    if (!this.options.skipAttributes) {
      if (attr.value?.type === 'StringLiteral') {
        const isEmpty = attr.value.value.trim() === ''
        if (!isEmpty) this.report(attr.value.span.start, attr.value.span.end)
      }
    }
    return attr
  }
}

async function parseStrings(file: string, options: Options) {
  const source = await fs.readFile(file, 'utf-8')
  const module = await parse(source, {
    target: 'es2022',
    syntax: file.endsWith('.tsx') ? 'typescript' : 'ecmascript',
    tsx: true,
    jsx: true
  })
  const visitor = new StringVisitor(file, source, options)
  visitor.visitModule(module)
}

async function readFiles(dir: string, options: Options) {
  const files = await fs.readdir(dir)
  for (const file of files) {
    const extension = path.extname(file)
    if (extension === '.jsx' || extension === '.tsx') {
      await parseStrings(path.join(dir, file), options)
    } else {
      const stat = await fs.stat(path.join(dir, file))
      if (stat.isDirectory()) await readFiles(path.join(dir, file), options)
    }
  }
}

async function main(src: string, opts: Record<string, any>) {
  const target = path.isAbsolute(src) ? src : path.join(process.cwd(), src)
  return readFiles(target, {
    skipAttributes: opts['skip-attributes'] || false,
    skipText: opts['skip-text'] || false
  })
}
