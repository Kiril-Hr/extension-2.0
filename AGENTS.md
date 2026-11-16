# DevEx contributor instructions

These instructions apply throughout the DevEx workspace. Preserve any additional instructions in nested `AGENTS.md` files.

## Code Style and Readability

Follow the existing Prettier configuration and preserve the author's coding style.

### Logical spacing

- Separate logically independent sections of code with exactly one blank line.
- Add a blank line after the import section before declarations.
- Separate variable initialization, event registration, business logic, and external API calls when they represent distinct operations.
- Within functions, separate setup, validation, data transformation, side effects, and return statements when appropriate.
- Keep closely related statements together without unnecessary blank lines.
- Never produce large, uninterrupted blocks of unrelated statements.
- Do not add multiple consecutive blank lines.

### Code structure

- Prefer concise, readable TypeScript.
- Use meaningful names and explicit types where they improve clarity.
- Prefer early returns when they simplify control flow.
- Use `map`, `filter`, `reduce`, object-based dispatch, and ternary expressions when they make the algorithm clearer.
- Avoid unnecessary temporary variables, deeply nested conditions, and excessive boilerplate.
- Preserve encapsulation, modularity, and clear separation of responsibilities.
- Do not introduce abstractions solely to reduce line count.
- Do not sacrifice readability, type safety, or performance for shorter code.

### Formatting

- Use 2-space indentation.
- Use single quotes.
- Omit semicolons.
- Avoid unnecessary parentheses around single arrow-function parameters.
- Follow the repository's Prettier configuration.
- Do not change runtime behavior solely for formatting.

When editing existing files, apply these rules to the modified sections. Avoid unrelated formatting changes across the repository.
