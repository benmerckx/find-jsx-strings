#!/usr/bin/env node

import {
  Expression,
  ImportDeclaration,
  JSXAttribute,
  JSXText,
  parse,
  StringLiteral,
  TemplateLiteral,
  TsType
} from '@swc/core'
import sade from 'sade'
import {createRequire} from 'module'
import path from 'path'
import fs from 'fs/promises'
import {Visitor} from '@swc/core/Visitor.js'

type Options = {
  skipAttributes: boolean | Array<string>
  skipText: boolean
  skipPattern?: Array<string>
  skipFiles?: Array<string>
  minLength: number
  includeLiteral: boolean
  includeTemplate: boolean
}

const version = createRequire(import.meta.url)('../package.json').version
let found = 0

sade('find_strings <src>', true)
  .version(version)
  .option('--min', 'Minimum length of string to find')
  .option('-A, --skip-attributes', 'Skip string attributes')
  .option('--skip-text', 'Skip JSX text')
  .option(
    '-P, --skip-pattern',
    'Skip text or attributes that include this string'
  )
  .option('--skip-files', 'Skip files that include this string')
  .option('--include-literal', 'Include string literals')
  .option('--include-template', 'Include template literals')
  .describe('Scan for hardcoded strings in JSX')
  .action(main)
  .parse(process.argv)

function color(line: string, color: number) {
  return line ? `\x1b[${color}m${line}\x1b[39m` : ''
}

// Based on: https://stackoverflow.com/a/63893237
function byteLengthCharCode(code: number) {
  if (code < 0x0080) return 1
  if (code < 0x0800) return 2
  if (code < 0xd800) return 3
  if (code < 0xdfff) return 2
  return 3
}

class StringVisitor extends Visitor {
  offset = 0
  constructor(
    public sourceFile: string,
    public sourceContent: string,
    public options: Options
  ) {
    super()
  }
  visitModule(m) {
    this.offset = m.span.start
    return super.visitModule(m)
  }
  report(byteStart: number, byteEnd: number) {
    // Spans in swc are byte offsets, not character positions
    const {skipPattern} = this.options
    const startLine = {lineNr: 0, start: 0}
    const endLine = {lineNr: 0, end: undefined}
    let byteIndex = 0,
      start = 0,
      end = 0
    for (let i = 0; i < this.sourceContent.length; i++) {
      const code = this.sourceContent.charCodeAt(i)
      if (code === 10) {
        if (byteIndex < byteStart) {
          startLine.lineNr++
          startLine.start = i + 1
        }
        if (byteIndex < byteEnd) {
          endLine.lineNr++
        } else {
          endLine.end = i
          break
        }
      }
      if (byteIndex === byteStart) start = i
      if (byteIndex === byteEnd) end = i
      byteIndex += byteLengthCharCode(code)
    }

    const lines = endLine.lineNr - startLine.lineNr + 1
    const source = this.sourceContent.slice(startLine.start, endLine.end)

    if (skipPattern) {
      for (const pattern of skipPattern) {
        if (source.includes(pattern)) return
      }
    }

    const prefix = found === 0 ? '' : '\n'
    console.log(
      `${prefix}\x1b[35m${this.sourceFile}:${startLine.lineNr + 1}\x1b[39m`
    )

    const pad = Math.max(4, String(endLine.lineNr).length)
    let index = startLine.start

    for (const [i, line] of source.split('\n').entries()) {
      const nr = startLine.lineNr + i + 1
      const pre = i === 0 ? start - index : 0
      const post = i === lines - 1 ? end - index : line.length
      const highlight = line.slice(pre, post)
      const content =
        color(line.slice(0, pre), 90) + highlight + color(line.slice(post), 90)
      console.log(` ${String(nr).padStart(pad, ' ')} │ ${content}`)
      index += line.length + 1
    }

    found++
  }
  visitJSXText(text: JSXText) {
    const {skipText, minLength} = this.options
    if (!skipText) {
      const isEmpty = text.value.trim().length < minLength
      if (!isEmpty)
        this.report(text.span.start - this.offset, text.span.end - this.offset)
    }
    return super.visitJSXText(text)
  }
  visitJSXAttribute(attr: JSXAttribute) {
    const {skipAttributes, minLength} = this.options
    if (skipAttributes === true) return super.visitJSXAttribute(attr)
    if (Array.isArray(skipAttributes)) {
      const attrName =
        'value' in attr.name
          ? attr.name.value
          : attr.name.namespace + ':' + attr.name.name
      if (skipAttributes.includes(attrName)) return attr
    }
    if (attr.value?.type === 'StringLiteral') {
      const isEmpty = attr.value.value.trim().length < minLength
      if (!isEmpty)
        this.report(
          attr.value.span.start - this.offset,
          attr.value.span.end - this.offset
        )
      return attr
    }
    return super.visitJSXAttribute(attr)
  }
  visitTemplateLiteral(literal: TemplateLiteral): Expression {
    const {includeTemplate} = this.options
    if (includeTemplate)
      this.report(
        literal.span.start - this.offset,
        literal.span.end - this.offset
      )
    return super.visitTemplateLiteral(literal)
  }
  visitStringLiteral(literal: StringLiteral): StringLiteral {
    const {includeLiteral, minLength} = this.options
    if (includeLiteral && literal.value.trim().length >= minLength)
      this.report(
        literal.span.start - this.offset,
        literal.span.end - this.offset
      )
    return literal
  }
  visitImportDeclaration(n: ImportDeclaration): ImportDeclaration {
    // Skip string literals in imports
    return n
  }
  visitTsType(tsType: TsType) {
    return tsType
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
  const {skipFiles} = options
  const files = await fs.readdir(dir)
  read: for (const file of files) {
    const extension = path.extname(file)
    if (extension === '.jsx' || extension === '.tsx') {
      if (skipFiles) {
        for (const skipPattern of skipFiles) {
          if (file.includes(skipPattern)) continue read
        }
      }
      await parseStrings(path.join(dir, file), options)
    } else {
      const stat = await fs.stat(path.join(dir, file))
      if (stat.isDirectory()) await readFiles(path.join(dir, file), options)
    }
  }
}

async function main(src: string, opts: Record<string, any>) {
  const target = path.isAbsolute(src) ? src : path.join(process.cwd(), src)
  const skipAttributes = opts['skip-attributes']
  await readFiles(target, {
    skipAttributes:
      typeof skipAttributes === 'string'
        ? skipAttributes.split(',')
        : skipAttributes,
    skipText: opts['skip-text'] || false,
    skipPattern:
      typeof opts['skip-pattern'] === 'string'
        ? [opts['skip-pattern']]
        : opts['skip-pattern'],
    skipFiles:
      typeof opts['skip-files'] === 'string'
        ? opts['skip-files'].split(',')
        : opts['skip-files'],
    minLength: opts['min'] || 1,
    includeLiteral: opts['include-literal'] || false,
    includeTemplate: opts['include-template'] || false
  })
  console.log(`\n\x1b[36m> Found ${found} strings\x1b[39m`)
}
