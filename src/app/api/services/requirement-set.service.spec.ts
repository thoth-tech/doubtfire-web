import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RequirementSet } from './requirement-set.service';
import API_URL from 'src/app/config/constants/apiURL';

describe('RequirementSetService', () => {
  let service: RequirementSet;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [RequirementSet]
    });

    service = TestBed.inject(RequirementSet);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getRequirementSets', () => {
    it('should retrieve all requirement sets', () => {
      const mockRequirementSets = [
        {
          id: '1',
          requirementSetGroupId: 1,
          description: 'Core programming skills',
          unitId: 1,
          requirementId: 1
        },
        {
          id: '2',
          requirementSetGroupId: 1,
          description: 'Advanced programming concepts',
          unitId: 1,
          requirementId: 2
        }
      ];

      service.getRequirementSets().subscribe(response => {
        expect(response).toEqual(mockRequirementSets);
      });

      const req = httpMock.expectOne(`${API_URL}/requirementset`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRequirementSets);
    });
  });

  describe('getRequirementSetById', () => {
    it('should retrieve a specific requirement set by id', () => {
      const mockRequirementSet = {
        id: '1',
        requirementSetGroupId: 1,
        description: 'Core programming skills',
        unitId: 1,
        requirementId: 1
      };

      service.getRequirementSetById().subscribe(response => {
        expect(response).toEqual(mockRequirementSet);
      });

      const req = httpMock.expectOne(`${API_URL}/requirementset/:id:`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRequirementSet);
    });
  });

  describe('addNewRequirementSet', () => {
    it('should create a new requirement set', () => {
      const mockNewRequirementSet = {
        requirementSetGroupId: 1,
        name: 'Database Skills',
        description: 'Essential database management skills',
        unitId: '1',
        requirementId: 3
      };

      const mockResponse = {
        id: '3',
        ...mockNewRequirementSet
      };

      service.addNewRequirementSet(
        mockNewRequirementSet.requirementSetGroupId,
        mockNewRequirementSet.name,
        mockNewRequirementSet.description,
        mockNewRequirementSet.unitId,
        mockNewRequirementSet.requirementId
      ).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${API_URL}/requirementset`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });
  });

  describe('updateRequirementSet', () => {
    it('should update an existing requirement set', () => {
      const mockUpdateData = {
        requirementSetGroupId: 1,
        name: 'Updated Skills',
        description: 'Updated description',
        code: 'CODE123'
      };

      const mockResponse = {
        id: '1',
        ...mockUpdateData
      };

      service.updateRequirementSet(
        mockUpdateData.requirementSetGroupId,
        mockUpdateData.name,
        mockUpdateData.description,
        mockUpdateData.code
      ).subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${API_URL}/requirementset`);
      expect(req.request.method).toBe('PUT');
      req.flush(mockResponse);
    });
  });
});
