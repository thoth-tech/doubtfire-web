import {Component, OnInit, ViewChild, ElementRef} from '@angular/core';
import {MediaObserver} from 'ng-flex-layout';

@Component({
  selector: 'f-tutorial-csv',
  templateUrl: './tutorial-csv.component.html',
  styleUrl: './tutorial-csv.component.scss',
})
export class TutorialCsvComponent implements OnInit {
  @ViewChild('fileInput') fileInput: ElementRef | undefined; // Reference to file input
  file: File | null = null; // Store the selected file
  responseMessage: string = '';
  successMessages: unknown[] = [];
  ignoredMessages: unknown[] = [];
  errorMessages: unknown[] = [];

  constructor(public media: MediaObserver) {}

  ngOnInit(): void {
    console.log('Component initialized');
  }

  // Handle file selection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFileChange(event: any): void {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      this.file = selectedFile;
      this.confirmUpload();
    }
  }

  // Show confirmation dialog before uploading the file
  confirmUpload(): void {
    if (this.file) {
      const confirmUpload = window.confirm(
        `Are you sure you want to upload the file: ${this.file.name}?`,
      );
      if (confirmUpload) {
        this.uploadFile();
      } else {
        this.responseMessage = 'File upload cancelled.';
        this.clearFileInput();
      }
    }
  }

  // Reset file input to trigger the file selection process again
  clearFileInput(): void {
    this.file = null;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Upload the selected file
  uploadFile(): void {
    if (this.file) {
      const formData = new FormData();
      formData.append('file', this.file);

      // Retrieve the token from localStorage
      const user = JSON.parse(localStorage.getItem('doubtfire_user') || '[]');
      console.log(user);
      const token = user.authenticationToken;
      const username = user.username;

      if (!token) {
        console.log('No authentication token found!');
        return;
      }

      // Make the POST request to upload the CSV file
      fetch('/api/csv/tutorials/upload', {
        method: 'POST',
        headers: {
          'auth-token': `${token}`,
          'username': `${username}`,
        },
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to upload CSV');
          }
          return response.json();
        })
        .then((data) => {
          if (data && Array.isArray(data.success)) {
            // Extract message fields from the returned objects
            this.successMessages = data.success.map((item: {message: string}) => item.message);
            this.ignoredMessages = (data.ignored || []).map(
              (item: {message: string}) => item.message,
            );
            this.errorMessages = (data.errors || []).map((item: {message: string}) => item.message);

            // Set a general response message based on upload result
            if (this.errorMessages.length > 0) {
              this.responseMessage = 'There were some errors during the upload.';
            } else if (this.successMessages.length > 0) {
              this.responseMessage = 'File uploaded successfully!';
            } else {
              this.responseMessage = 'Upload completed, but no new tutorials were processed.';
            }

            // Clear the file input after the upload
            this.file = null;
            this.fileInput.nativeElement.value = ''; // Reset the file input

            // Optionally show the messages to the user
            this.showMessages();
          } else {
            // Handle unexpected response format
            this.responseMessage = 'Invalid response format from the server.';
            console.error('Invalid response:', data);
          }
        })
        .catch((error) => {
          this.responseMessage = `Error: ${error.message}`;
          console.error('Error:', error);
        });
    }
  }

  showMessages(): void {
    if (this.successMessages.length > 0) {
      alert(`Success: \n${this.successMessages.join('\n')}`);
    }
    if (this.ignoredMessages.length > 0) {
      alert(`Ignored: \n${this.ignoredMessages.join('\n')}`);
    }
    if (this.errorMessages.length > 0) {
      alert(`Errors: \n${this.errorMessages.join('\n')}`);
    }
  }

  downloadFile(): void {
    const user = JSON.parse(localStorage.getItem('doubtfire_user') || '{}');
    const token = user.authenticationToken;
    const username = user.username;

    if (!token) {
      console.log('No authentication token found!');
      return;
    }

    fetch('/api/csv/tutorials/download', {
      method: 'GET',
      headers: {
        'auth-token': `${token}`,
        'username': `${username}`,
      },
    })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to download file');
        return response.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tutorials.csv';
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        this.responseMessage = 'File downloaded successfully!';
      })
      .catch((error) => {
        this.responseMessage = `Download error: ${error.message}`;
        console.error(error);
      });
  }

  onButtonClick(): void {
    const user = JSON.parse(localStorage.getItem('doubtfire_user') || '[]');
    console.log(user);
    const token = user.authenticationToken;
    const username = user.username;

    if (!token) {
      console.log('No authentication token found!');
      return;
    } else {
      console.log('Token found');
    }

    fetch('/api/ping', {
      method: 'GET',
      headers: {
        'auth-token': `${token}`,
        'username': `${username}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        console.log('API response:', data);
        alert('Connection successful: ' + data.message);
      })
      .catch((error) => {
        console.error('Error connecting to API:', error);
        alert('Failed to connect to API: ' + error.message);
      });
  }
}
