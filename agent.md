# GitHub Copilot Instructions for vscode-dascript

## Project Overview
This is a VS Code language extension providing syntax highlighting for daScript, a high-performance statically strong typed scripting language designed for embedding in real-time applications like games.

## Project Structure
- **package.json**: Extension manifest defining language contributions and grammars
- **language-configuration.json**: Language configuration for comments, brackets, and auto-pairing
- **syntaxes/dascript.tmLanguage.yaml**: Source TextMate grammar file (YAML format)
- **syntaxes/dascript.tmLanguage.json**: Compiled TextMate grammar (JSON format, auto-generated)

## Language: daScript Syntax Details

### File Extensions
- `.das` - Standard daScript files
- `.dascript` - Alternative daScript extension
- `.das_project` - Project files

### Comment Styles
- Single-line: `//`
- Block: `/* ... */`

### Language Features to Support
- **Control Flow**: while, if, static_if, else, for, elif, static_elif, return, break, continue, try, expect, finally, yield
- **Declarations**: var, let, assume, const, struct, class, function, typedef
- **Modifiers**: inscope, static, shared, public, private, override, sealed, unsafe, implicit, explicit
- **Type System**: Built-in types include iterator, array, fixed_array, table, smart_ptr, generator, tuple, variant, lambda, block, function
- **Operators**: Standard arithmetic, logical, assignment (=, :=, <-), pipeline (<|, |>), null-coalescing (?., ??)
- **Memory**: new, delete, deref, addr
- **Type Operations**: cast, upcast, reinterpret, is, as, type, typename, typeinfo
- **Advanced**: with, where, pass, label, goto, capture, operator overloading

### Numeric Literals
- Hex: `0x...` (with optional L or u suffix)
- Binary: `0b...` (with optional L suffix)
- Octal: `0...` or `0o...`
- Float: Support for scientific notation (e.g., `1.5e10F`)
- Type suffixes: `i8`, `u8`, `L` (long), `F` (float)

## Development Workflow

### Building the Grammar
1. Edit `syntaxes/dascript.tmLanguage.yaml` for grammar changes
2. Run build task: `npx js-yaml syntaxes/dascript.tmLanguage.yaml > syntaxes/dascript.tmLanguage.json`
3. Never manually edit the `.json` file - it's auto-generated from YAML

### Testing
- Press F5 in VS Code to launch Extension Development Host
- Open `.das` files to verify syntax highlighting
- Test edge cases with different daScript constructs

## TextMate Grammar Conventions

### Scope Naming
Follow TextMate conventions for consistency:
- `keyword.control.*` - Control flow keywords
- `storage.modifier.*` - Declaration and modifier keywords
- `keyword.type.*` - Type-related keywords
- `keyword.operator.*` - Operators
- `constant.numeric.*` - Number literals
- `constant.language.*` - Language constants (true, false, null)
- `string.quoted.*` - String literals
- `comment.line.*` / `comment.block.*` - Comments
- `entity.name.function.*` - Function names
- `entity.name.type.*` - Type names
- `variable.*` - Variable references

### Pattern Order Matters
- More specific patterns should come before general ones
- Include patterns in logical order for proper syntax precedence

### Regular Expression Best Practices
- Use `\b` for word boundaries on keywords
- Escape special characters properly
- Use non-capturing groups `(?:...)` when capture isn't needed
- Test patterns against various daScript code samples

## Code Style Guidelines

### YAML Grammar File
- Use 2-space indentation
- Group related patterns together with comments
- Keep patterns readable with descriptive names
- Use `include` references to avoid duplication
- Document complex regex patterns with inline comments

### JSON Files
- Use 4-space indentation (for package.json)
- No trailing commas
- Use double quotes for strings

## Dependencies
- **js-yaml**: Converts YAML grammar to JSON format
- Minimum VS Code version: 1.40.0

## Publishing
- Publisher: eguskov
- Repository: https://github.com/GaijinEntertainment/vscode-dascript
- Current version: 0.0.18
- Update CHANGELOG.md for notable changes
- Increment version in package.json following semver

## Common Tasks

### Adding New Keywords
1. Identify the appropriate category (control, storage, type, operator)
2. Add to the relevant pattern in `dascript.tmLanguage.yaml`
3. Use correct scope name for the category
4. Rebuild the grammar

### Adding Support for New Syntax
1. Create a new repository pattern with descriptive name
2. Add pattern to main `patterns` list if top-level
3. Use `include` to reference from other patterns
4. Test with real daScript code examples

### Fixing Highlighting Issues
1. Identify which pattern is matching (or failing to match)
2. Check pattern order - more specific should come first
3. Verify regex is properly escaped
4. Test edge cases after making changes

## Documentation Access

### Using Context7 MCP for daScript Documentation
When you need information about daScript language features, syntax, or APIs:

1. **Resolve the library ID first:**
   ```
   Use mcp_context7_resolve-library-id with libraryName: "daslang" or "dascript"
   ```

2. **Fetch documentation:**
   ```
   Use mcp_context7_get-library-docs with the resolved library ID
   - Use mode='code' for API references and code examples
   - Use mode='info' for conceptual guides and language features
   - Specify topic parameter for focused queries (e.g., 'functions', 'types', 'operators')
   ```

3. **Example queries:**
   - Function syntax: topic='functions', mode='code'
   - Type system: topic='types', mode='info'
   - Operators: topic='operators', mode='code'
   - Control flow: topic='control flow', mode='info'

**Always use Context7 MCP instead of external web searches** to get accurate, up-to-date daScript documentation when:
- Adding support for new language features
- Verifying syntax patterns
- Understanding language semantics
- Resolving ambiguities in grammar rules

## Resources
- daScript documentation (via Context7 MCP): Use tools above for live docs
- daScript website: https://dascript.org/ (secondary reference)
- TextMate grammar guide: https://macromates.com/manual/en/language_grammars
- VS Code language extension guide: https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide

## Notes for Copilot
- This is a **syntax highlighting only** extension (no LSP, no IntelliSense)
- Focus on accurate TextMate grammar patterns
- daScript syntax is similar to C++ but with modern features
- Performance is important for daScript - the language targets real-time applications
- Always rebuild grammar JSON after editing YAML source
