import { Component, OnInit, OnDestroy, ElementRef, HostListener, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppInjector } from 'src/app/app-injector';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';
import { Subscription } from 'rxjs';

// Define structure of a Notification object
interface Notification {
  id: number;
  message: string;
}

@Component({
  selector: 'f-notifications-button',
  templateUrl: './notifications-button.component.html',
  styleUrls: ['./notifications-button.component.css']
})
export class NotificationsButtonComponent implements OnInit, OnDestroy {

  // Tracks whether the notifications dropdown is visible
  showNotifications = false;

  // List of notifications to be displayed
  notifications: Notification[] = [];

  // Track active subscriptions for cleanup
  private subscriptions = new Subscription();

  // Reference to the notification panel in the DOM
  @ViewChild('panel') panelRef!: ElementRef;

  private readonly API_URL = AppInjector.get(DoubtfireConstants).API_URL;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadNotifications();
  }

  ngOnDestroy() {
    // Prevent memory leaks
    this.subscriptions.unsubscribe();
  }

  // Close panel when clicking outside of it
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.showNotifications && this.panelRef && !this.panelRef.nativeElement.contains(event.target)) {
      this.showNotifications = false;
    }
  }

  // Toggle the visibility of the notifications dropdown
  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  // Fetch notifications from the API
  loadNotifications() {
    this.subscriptions.add(
      this.http.get<Notification[]>(`${this.API_URL}/notifications`).subscribe({
        next: data => this.notifications = data,
        error: err => console.error('Error loading notifications', err)
      })
    );
  }

  // Remove a specific notification by ID
  dismissNotification(notificationId: number) {
    this.subscriptions.add(
      this.http.delete(`${this.API_URL}/notifications/${notificationId}`).subscribe({
        next: () => {
          this.notifications = this.notifications.filter(note => note.id !== notificationId);
        },
        error: err => console.error('Error deleting notification', err)
      })
    );
  }

  // Delete all notifications
  deleteAllNotifications() {
    this.subscriptions.add(
      this.http.delete(`${this.API_URL}/notifications`).subscribe({
        next: () => {
          this.notifications = [];
        },
        error: err => console.error('Error deleting all notifications', err)
      })
    );
  }

}

