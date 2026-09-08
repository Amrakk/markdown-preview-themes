# Markdown Preview Themes

Customize VS Code's built-in Markdown preview with different themes. Switch between VS Code's default styling and prebuilt themes.

## Usage

Open VS Code settings and set your preferred theme:

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
3. Set the folder path in VS Code settings:
    ```json
    {
        "markdownPreviewThemes.themesFolder": "~/my-themes"
    }
    ```

The extension automatically discovers all `.css` files in that folder and adds them to your theme options. You can then select them in the `markdownPreviewThemes.theme` setting.

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

## Requirements

- VS Code 1.90.0 or later

## License

MIT
