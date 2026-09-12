# Markdown Preview Themes

Customize VS Code's built-in Markdown preview with different themes. Switch between VS Code's default styling and prebuilt themes.

## Usage

Run **Markdown Preview Themes: Select Theme** from the Command Palette and choose a theme.

You can also set the theme name directly:

```json
{
    "markdownPreviewThemes.theme": "dracula"
}
```

The theme updates instantly in any open Markdown preview.

## Custom Themes

Add your own CSS themes by pointing to a folder:

1. Create a folder with your custom theme CSS files (e.g., `~/my-themes/`)
2. Place your CSS files in that folder (e.g., `mytheme.css`, `custom.css`)
3. Run **Markdown Preview Themes: Change Themes Folder**, or set the folder path in VS Code settings:

```json
{
    "markdownPreviewThemes.themesFolder": "~/my-themes"
}
```

The extension automatically discovers all `.css` files in that folder and adds them to the **Markdown Preview Themes: Select Theme** picker. A custom file with the same name as a built-in theme overrides the built-in theme.

Changes to the folder (adding/removing CSS files) are detected automatically.

### Theme CSS Structure

Your CSS should target the `data-theme` attribute:

```css
body:has(#markdown-preview-themes[data-theme="mytheme"]) {
    background-color: #f5f5f5;
    color: #333;
    /* Add your custom styles here */
}
```

Custom theme CSS is applied after bundled styles, so your CSS can override them.

### Selecting a Hook

Hooks add optional Markdown features to a theme. To choose one:

1. Select the theme you want to configure.
2. Run **Markdown Preview Themes: Configure Hook for Current Theme** from the
   Command Palette.
3. Choose a built-in hook, **No hook**, or **Automatic**.
4. Apply the choice only to the current theme or use it as the default for
   themes without their own selection.

**Automatic** uses the hook with the same name as the selected theme when one
exists. Your selection is saved and applied whenever the Markdown preview is
refreshed.

### Built-in Hooks

- [GitHub](hooks/github/README.md) — Adds GitHub-style alert blocks such as
  `[!NOTE]`, `[!TIP]`, and `[!WARNING]`.

## Requirements

- VS Code 1.90.0 or later

## License

MIT
