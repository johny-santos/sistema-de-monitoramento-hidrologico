document.addEventListener('DOMContentLoaded', function () {

    const sidebarButton = document.getElementById('sidebarCollapse');
    const appShell = document.querySelector('.app-shell');

    if (!sidebarButton || !appShell) {
        return;
    }

    sidebarButton.addEventListener('click', function () {

        appShell.classList.toggle('sidebar-collapsed');

        const collapsed = appShell.classList.contains('sidebar-collapsed');

        sidebarButton.setAttribute('aria-expanded', !collapsed);

        sidebarButton.setAttribute(
            'aria-label',
            collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'
        );

    });

});