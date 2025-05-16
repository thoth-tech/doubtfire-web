import { EntityService } from '../services/entity.service';
import { User } from './user/user';

export class Organization {
  id: number;
  name: string;
  description: string;
  email: string;
  is_enabled: boolean;
  users: User[];

  constructor(params: any) {
    this.id = params.id;
    this.name = params.name;
    this.description = params.description;
    this.email = params.email;
    this.is_enabled = params.is_enabled;
    this.users = params.users || [];
  }

  matches(filter: string): boolean {
    return (
      this.name.toLowerCase().includes(filter.toLowerCase()) ||
      (this.description && this.description.toLowerCase().includes(filter.toLowerCase()))
    );
  }
}