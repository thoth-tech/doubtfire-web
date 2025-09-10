describe('Requirement Set Management', () => {
  beforeEach(() => {
    // Login and navigate to the requirement management page
    cy.login('admin', 'password');
    cy.visit('/admin/requirement-sets');
  });

  it('should list all requirement sets', () => {
    cy.intercept('GET', '/api/requirementset', {
      fixture: 'requirementSets.json'
    }).as('getRequirementSets');

    cy.wait('@getRequirementSets');
    cy.get('[data-testid=requirement-set-list]').should('be.visible');
    cy.get('[data-testid=requirement-set-item]').should('have.length.at.least', 1);
  });

  it('should create a new requirement set', () => {
    const newRequirementSet = {
      requirementSetGroupId: 1,
      name: 'Test Requirement Set',
      description: 'Test Description',
      unitId: '1',
      requirementId: 1
    };

    cy.intercept('POST', '/api/requirementset', {
      statusCode: 201,
      body: { id: '123', ...newRequirementSet }
    }).as('createRequirementSet');

    cy.get('[data-testid=add-requirement-set-btn]').click();
    cy.get('[data-testid=requirement-set-name-input]').type(newRequirementSet.name);
    cy.get('[data-testid=requirement-set-description-input]').type(newRequirementSet.description);
    cy.get('[data-testid=requirement-set-group-select]').select(newRequirementSet.requirementSetGroupId.toString());
    cy.get('[data-testid=requirement-set-unit-select]').select(newRequirementSet.unitId);
    cy.get('[data-testid=requirement-set-requirement-select]').select(newRequirementSet.requirementId.toString());
    cy.get('[data-testid=save-requirement-set-btn]').click();

    cy.wait('@createRequirementSet');
    cy.get('[data-testid=requirement-set-item]').should('contain', newRequirementSet.name);
  });

  it('should update an existing requirement set', () => {
    const updatedDescription = 'Updated Description';

    cy.intercept('PUT', '/api/requirementset', {
      statusCode: 200,
      body: { description: updatedDescription }
    }).as('updateRequirementSet');

    cy.get('[data-testid=requirement-set-item]').first().click();
    cy.get('[data-testid=edit-requirement-set-btn]').click();
    cy.get('[data-testid=requirement-set-description-input]').clear().type(updatedDescription);
    cy.get('[data-testid=save-requirement-set-btn]').click();

    cy.wait('@updateRequirementSet');
    cy.get('[data-testid=requirement-set-item]').first().should('contain', updatedDescription);
  });

  it('should handle error cases gracefully', () => {
    // Test server error
    cy.intercept('GET', '/api/requirementset', {
      statusCode: 500,
      body: { error: 'Internal Server Error' }
    }).as('getRequirementSetsError');

    cy.wait('@getRequirementSetsError');
    cy.get('[data-testid=error-message]').should('be.visible');
    cy.get('[data-testid=error-message]').should('contain', 'Error loading requirement sets');

    // Test validation error
    const invalidRequirementSet = {
      requirementSetGroupId: 1,
      name: '', // Invalid - empty name
      description: 'Test Description',
      unitId: '1',
      requirementId: 1
    };

    cy.get('[data-testid=add-requirement-set-btn]').click();
    cy.get('[data-testid=requirement-set-name-input]').type(invalidRequirementSet.name);
    cy.get('[data-testid=save-requirement-set-btn]').click();
    cy.get('[data-testid=validation-error]').should('be.visible');
    cy.get('[data-testid=validation-error]').should('contain', 'Name is required');
  });
});
