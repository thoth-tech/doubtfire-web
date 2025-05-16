import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Organization } from 'src/app/api/models/organization';
import { OrganizationService } from 'src/app/api/services/organization.service';
import { AlertService } from 'src/app/common/services/alert.service';

@Component({
  selector: 'f-organizations',
  templateUrl: './organizations.component.html',
  styleUrls: ['./organizations.component.scss']
})
export class OrganizationsComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = ['name', 'description', 'email', 'is_enabled', 'actions'];
  organizations: Organization[] = [];
  loading: boolean = true;

  @ViewChild(MatTable) table: MatTable<Organization>;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private organizationService: OrganizationService,
    private alertService: AlertService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadOrganizations();
  }

  ngAfterViewInit() {
    // Add sorting and pagination if needed
  }

  loadOrganizations(): void {
    this.loading = true;
    this.organizationService.query().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
        this.loading = false;
        if (this.table) {
          this.table.renderRows();
        }
      },
      error: (err) => {
        this.alertService.error('Failed to load organizations: ' + err);
        this.loading = false;
      }
    });
  }

  createOrganization(): void {
    // TODO: Implement create organization dialog
  }

  editOrganization(organization: Organization): void {
    // TODO: Implement edit organization dialog
  }

  deleteOrganization(organization: Organization): void {
    // TODO: Implement delete organization confirmation dialog
    this.organizationService.deleteOrganization(organization.id).subscribe({
      next: () => {
        this.alertService.success('Organization deleted successfully');
        this.loadOrganizations();
      },
      error: (err) => {
        this.alertService.error('Failed to delete organization: ' + err);
      }
    });
  }

  addMember(organization: Organization): void {
    // TODO: Implement add member dialog
  }

  viewMembers(organization: Organization): void {
    // TODO: Implement view members dialog
    this.organizationService.getMembers(organization.id).subscribe({
      next: (members) => {
        // TODO: Show members in dialog
        console.log('Members:', members);
      },
      error: (err) => {
        this.alertService.error('Failed to load members: ' + err);
      }
    });
  }
} 