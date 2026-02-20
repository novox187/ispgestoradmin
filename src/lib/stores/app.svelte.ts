export class AppState {
    isSidebarOpen = $state(false);
    isNotificationsOpen = $state(false);

    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
    }

    toggleNotifications() {
        this.isNotificationsOpen = !this.isNotificationsOpen;
    }
}

export const appState = new AppState();