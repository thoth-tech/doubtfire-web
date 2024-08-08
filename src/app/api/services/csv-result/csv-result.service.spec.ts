import { TestBed } from '@angular/core/testing';

import { CsvResultService } from './csv-result.service';

describe('CsvResultService', () => {
  let service: CsvResultService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CsvResultService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
