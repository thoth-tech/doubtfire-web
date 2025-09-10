import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UnitService } from './unit.service';
import { Unit } from '../models/unit';
import API_URL from 'src/app/config/constants/apiURL';

describe('UnitService', () => {
  let service: UnitService;
  let httpMock: HttpTestingController;

  const mockUnits = [
    {
      code: 'COS10001',
      id: 1,
      name: 'Introduction to Programming',
      my_role: 'Admin',
      main_convenor_user_id: 2
    },
    {
      code: 'COS20007',
      id: 2,
      name: 'Object Oriented Programming',
      my_role: 'Admin',
      main_convenor_user_id: 2
    },
    {
      code: 'COS30046',
      id: 3,
      name: 'Artificial Intelligence for Games',
      my_role: 'Admin',
      main_convenor_user_id: 4
    },
    {
      code: 'COS30243',
      id: 4,
      name: 'Game Programming',
      my_role: 'Admin',
      main_convenor_user_id: 4
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UnitService]
    });

    service = TestBed.inject(UnitService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUnits', () => {
    it('should retrieve all units', () => {
      service.query().subscribe(units => {
        expect(units.length).toBe(4);
        expect(units).toEqual(mockUnits);
      });

      const req = httpMock.expectOne(`${API_URL}/units`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUnits);
    });

    it('should handle empty response', () => {
      service.query().subscribe(units => {
        expect(units.length).toBe(0);
      });

      const req = httpMock.expectOne(`${API_URL}/units`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getUnit', () => {
    it('should retrieve a specific unit by id', () => {
      const testUnit = mockUnits[0];

      service.get(testUnit.id).subscribe(unit => {
        expect(unit).toEqual(testUnit);
      });

      const req = httpMock.expectOne(`${API_URL}/units/${testUnit.id}`);
      expect(req.request.method).toBe('GET');
      req.flush(testUnit);
    });

    it('should handle unit not found', () => {
      const nonExistentId = 999;

      service.get(nonExistentId).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`${API_URL}/units/${nonExistentId}`);
      expect(req.request.method).toBe('GET');
      req.error(new ErrorEvent('404'), { status: 404 });
    });
  });

  describe('Unit filtering', () => {
    it('should filter programming units', () => {
      const programmingUnits = mockUnits.filter(unit => 
        unit.name.toLowerCase().includes('programming')
      );
      
      expect(programmingUnits.length).toBe(3);
      expect(programmingUnits.map(u => u.code)).toContain('COS10001');
      expect(programmingUnits.map(u => u.code)).toContain('COS20007');
      expect(programmingUnits.map(u => u.code)).toContain('COS30243');
    });

    it('should filter by course level', () => {
      const level3Units = mockUnits.filter(unit => 
        unit.code.startsWith('COS3')
      );
      
      expect(level3Units.length).toBe(2);
      expect(level3Units.map(u => u.code)).toContain('COS30046');
      expect(level3Units.map(u => u.code)).toContain('COS30243');
    });
  });

  describe('Unit convenor checks', () => {
    it('should identify units by convenor', () => {
      const convenor2Units = mockUnits.filter(unit => 
        unit.main_convenor_user_id === 2
      );
      
      expect(convenor2Units.length).toBe(2);
      expect(convenor2Units.map(u => u.code)).toContain('COS10001');
      expect(convenor2Units.map(u => u.code)).toContain('COS20007');
    });
  });
});
