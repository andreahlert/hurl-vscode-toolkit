# Hurl VS Code Toolkit Usage

This guide shows the most common ways to work with the Hurl VS Code Toolkit.

## Prerequisites

- Install [Hurl](https://hurl.dev/docs/installation.html) and make sure it is available in your `PATH`, or configure a custom path in the extension settings.
- Open a workspace that contains one or more `.hurl` files.

## Open and Edit Hurl Files

The extension activates automatically when you open a `.hurl` file. You get:

- Syntax highlighting for Hurl requests, headers, sections, variables, and embedded content
- IntelliSense for methods, headers, sections, status codes, options, assert predicates, and filters
- Hover information for supported keywords
- Diagnostics for common syntax issues

Use snippets to speed up authoring. Type a snippet prefix such as `hurl-get`, `hurl-post-json`, or `hurl-full`, then press `Tab` to insert a template.

## Run Requests

The extension adds CodeLens actions above request blocks:

- `Run Request` executes the request under the cursor
- `Run All` executes every request in the file

You can also use keyboard shortcuts inside `.hurl` files:

- `Ctrl+Enter` runs the current request under the cursor
- `Ctrl+Shift+Enter` runs the entire file

You can also use the command palette and run the extension commands directly:

- `Hurl: Run Request Entry`
- `Hurl: Run Entire File`

Results appear in the extension output channel. If webview previews are enabled, the response panel is reused between runs.

## Use the Notebook View

Any `.hurl` file can be opened as a VS Code notebook. Each HTTP request becomes an individual executable cell, letting you run requests one at a time and see rich output inline.

### Open a file as a notebook

Three ways to switch to the notebook view:

- Right-click a `.hurl` file in the Explorer and choose **Hurl: Open as Notebook**
- Click the notebook icon ($(notebook)) in the editor title bar while a `.hurl` file is active
- Open the command palette and run **Hurl: Open as Notebook**

To go back to the plain text editor, close the notebook tab and reopen the file normally.

### Run cells

Each cell contains one Hurl request entry. Use the cell run button or **Run All** in the notebook toolbar to execute cells. The active environment profile applies — variables, CLI arguments, and environment variables from the selected profile are all passed to hurl.

Cell output is rendered as markdown and includes:

- A success/failure indicator and the active environment label
- The HTTP status line (e.g. `HTTP/1.1 200 OK`)
- A collapsible **Response Headers** block
- The response body, formatted as JSON when applicable
- An **Error** block with the assertion failure location when a request fails

### Markdown cells

Lines beginning with `# md:` in a `.hurl` file become markdown cells in the notebook view. You can add these to annotate requests. The file remains valid Hurl syntax and can still be run with the plain text CodeLens or keyboard shortcuts.

## Use Environment Profiles

Environment profiles let you keep separate settings for local, staging, and production runs.

To switch profiles, use the status bar item labeled `Hurl: ...` or run:

- `Hurl: Select Environment`
- `Hurl: Clear Environment`

Profiles can override:

- The Hurl executable path
- A variables file
- Additional CLI arguments
- Template variables passed as `--variable name=value`
- Environment variables such as `HURL_INSECURE` or `HURL_VERBOSE`

If you want a default profile for new runs, set `hurl-toolkit.activeEnvironmentProfile` in your VS Code settings.

## Useful Settings

Common settings are available under the extension settings section:

- `hurl-toolkit.hurlPath` controls the Hurl binary path
- `hurl-toolkit.showResponseInWebview` toggles the response webview panel
- `hurl-toolkit.additionalArguments` appends extra CLI arguments
- `hurl-toolkit.variablesFile` points to a `--variables-file`
- `hurl-toolkit.activeEnvironmentProfile` chooses the default profile
- `hurl-toolkit.environmentProfiles` defines named profiles

Example configuration:

```json
{
  "hurl-toolkit.hurlPath": "hurl",
  "hurl-toolkit.showResponseInWebview": true,
  "hurl-toolkit.activeEnvironmentProfile": "staging",
  "hurl-toolkit.environmentProfiles": {
    "staging": {
      "variablesFile": ".hurl/staging.vars",
      "additionalArguments": "--verbose",
      "variables": {
        "base_url": "https://staging.example.com"
      },
      "environmentVariables": {
        "HURL_INSECURE": "true"
      }
    }
  }
}
```

## Recommended Workflow

1. Open or create a `.hurl` file.
2. Insert a snippet if you want a starter template.
3. Add assertions and captures for the response you expect.
4. Run a single request with `Run Request`.
5. Adjust settings or switch environment profiles when you need different run targets.

## Troubleshooting

- If Hurl does not run, check that the executable path is correct and available in your environment.
- If response previews look stale, clear the environment profile and run the request again.
- If completions or diagnostics do not appear, make sure the file is saved with a `.hurl` extension.

For a broader feature overview, see the [main README](../README.md).