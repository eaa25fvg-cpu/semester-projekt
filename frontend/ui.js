window.onload = async function loadThemes() {
    const response = await fetch('/api/theme');
    const themes = await response.json();

    const themeSelect = document.getElementById('theme-select');
    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.theme_id;
        option.textContent = theme.theme_name;
        themeSelect.appendChild(option);
    });
    console.log(themes)
}
