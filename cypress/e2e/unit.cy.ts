describe('Unit Management', () => {
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
    // Setup and login
    cy.login('admin', 'password');
    
    // Intercept API calls
    cy.intercept('GET', '/api/units', {
      statusCode: 200,
      body: mockUnits
    }).as('getUnits');
  });

  describe('Unit Listing', () => {
    it('should display all units', () => {
      cy.visit('/admin/units');
      cy.wait('@getUnits');

      // Check if all units are displayed
      mockUnits.forEach(unit => {
        cy.get('[data-testid=unit-list]')
          .should('contain', unit.code)
          .and('contain', unit.name);
      });
    });

    it('should filter units by search term', () => {
      cy.visit('/admin/units');
      cy.wait('@getUnits');

      // Search for "Programming"
      cy.get('[data-testid=unit-search-input]').type('Programming');

      // Should show 3 units
      cy.get('[data-testid=unit-list-item]').should('have.length', 3);
      cy.get('[data-testid=unit-list]')
        .should('contain', 'COS10001')
        .and('contain', 'COS20007')
        .and('contain', 'COS30243');
    });

    it('should filter units by level', () => {
      cy.visit('/admin/units');
      cy.wait('@getUnits');

      // Select level 3 units
      cy.get('[data-testid=unit-level-select]').select('3');

      // Should show 2 level 3 units
      cy.get('[data-testid=unit-list-item]').should('have.length', 2);
      cy.get('[data-testid=unit-list]')
        .should('contain', 'COS30046')
        .and('contain', 'COS30243');
    });
  });

  describe('Unit Details', () => {
    it('should display unit details correctly', () => {
      const testUnit = mockUnits[0];
      
      // Intercept specific unit request
      cy.intercept('GET', `/api/units/${testUnit.id}`, {
        statusCode: 200,
        body: testUnit
      }).as('getUnit');

      cy.visit(`/admin/units/${testUnit.id}`);
      cy.wait('@getUnit');

      // Check unit details
      cy.get('[data-testid=unit-code]').should('contain', testUnit.code);
      cy.get('[data-testid=unit-name]').should('contain', testUnit.name);
      cy.get('[data-testid=unit-convenor]').should('contain', testUnit.main_convenor_user_id);
    });
  });

  describe('Unit Navigation', () => {
    it('should navigate between unit pages', () => {
      cy.visit('/admin/units');
      cy.wait('@getUnits');

      // Click first unit
      cy.get('[data-testid=unit-list-item]').first().click();
      
      // Should be on unit details page
      cy.url().should('include', '/admin/units/1');

      // Go back to list
      cy.get('[data-testid=back-to-list]').click();
      cy.url().should('include', '/admin/units');
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      // Mock API error
      cy.intercept('GET', '/api/units', {
        statusCode: 500,
        body: { error: 'Server Error' }
      }).as('getUnitsError');

      cy.visit('/admin/units');
      cy.wait('@getUnitsError');

      // Should show error message
      cy.get('[data-testid=error-message]')
        .should('be.visible')
        .and('contain', 'Error loading units');
    });

    it('should handle non-existent unit', () => {
      cy.intercept('GET', '/api/units/999', {
        statusCode: 404,
        body: { error: 'Unit not found' }
      }).as('getNonExistentUnit');

      cy.visit('/admin/units/999');
      cy.wait('@getNonExistentUnit');

      // Should show not found message
      cy.get('[data-testid=not-found-message]')
        .should('be.visible')
        .and('contain', 'Unit not found');
    });
  });
});
