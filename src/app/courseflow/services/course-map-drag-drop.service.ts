/* eslint-disable @typescript-eslint/no-explicit-any */
import {Injectable} from '@angular/core';
import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import {CourseMapStateService} from './course-map-state.service';
import {DraggedUnitData, DropResult} from '../models/drag-drop.models';
import {SlotContext, CourseUnit} from '../models/course-map.models';
import {Unit} from 'src/app/api/models/doubtfire-model';

@Injectable({
  providedIn: 'root',
})
export class CourseMapDragDropService {
  constructor(private stateService: CourseMapStateService) {}

  handleDrop(event: CdkDragDrop<SlotContext | CourseUnit[]>): DropResult {
    const previousContainer = event.previousContainer;
    const currentContainer = event.container;
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    const draggedData = event.item.data as DraggedUnitData;
    const targetContainerData = currentContainer.data;

    // If unit is dragged to the same container
    if (previousContainer.id === currentContainer.id) {
      return this.handleSameContainerDrop(
        draggedData,
        currentContainer.data as CourseUnit[],
        previousIndex,
        currentIndex,
      );
    }

    // If drag to other container
    const targetIsSlot = this.isSlotContext(targetContainerData);
    const sourceIsSlot = draggedData.sourceContainerId === 'slot';

    if (targetIsSlot) {
      return this.handleDropToSlot(
        draggedData,
        targetContainerData as SlotContext,
        previousContainer.data as CourseUnit[],
        previousIndex,
        sourceIsSlot,
      );
    } else {
      return this.handleDropToList(
        draggedData,
        targetContainerData as CourseUnit[],
        previousContainer.data as CourseUnit[],
        previousIndex,
        currentIndex,
        sourceIsSlot,
      );
    }
  }

  private handleSameContainerDrop(
    draggedData: DraggedUnitData,
    containerData: CourseUnit[],
    previousIndex: number,
    currentIndex: number,
  ): DropResult {
    // Reordering drag drop within list
    if (draggedData.sourceContainerId !== 'slot') {
      moveItemInArray(containerData, previousIndex, currentIndex);
    }
    return {success: true};
  }

  private handleDropToSlot(
    draggedData: DraggedUnitData,
    targetContext: SlotContext,
    sourceList: CourseUnit[],
    previousIndex: number,
    sourceIsSlot: boolean,
  ): DropResult {
    const {yearIndex, trimesterKey, slotIndex} = targetContext;
    const currentState = this.stateService.currentState;
    const targetTrimesterArray = currentState.years[yearIndex][trimesterKey];
    const existingUnitInSlot = targetTrimesterArray[slotIndex];

    if (!existingUnitInSlot) {
      return this.placeUnitInEmptySlot(
        draggedData,
        targetContext,
        sourceList,
        previousIndex,
        sourceIsSlot,
      );
    } else {
      return this.handleOccupiedSlotDrop(
        draggedData,
        targetContext,
        existingUnitInSlot,
        sourceIsSlot,
      );
    }
  }

  private handleDropToList(
    draggedData: DraggedUnitData,
    targetList: CourseUnit[],
    sourceList: CourseUnit[],
    previousIndex: number,
    currentIndex: number,
    sourceIsSlot: boolean,
  ): DropResult {
    if (sourceIsSlot) {
      // Drag from slot to list
      targetList.splice(currentIndex, 0, draggedData.unit);
      this.stateService.removeUnitFromSlot(
        draggedData.sourceYearIndex!,
        draggedData.sourceTrimesterKey!,
        draggedData.sourceSlotIndex!,
      );
    } else {
      // Drag from list to list
      transferArrayItem(sourceList, targetList, previousIndex, currentIndex);
    }

    return {success: true};
  }

  private placeUnitInEmptySlot(
    draggedData: DraggedUnitData,
    targetContext: SlotContext,
    _sourceList: CourseUnit[],
    previousIndex: number,
    sourceIsSlot: boolean,
  ): DropResult {
    const currentState = this.stateService.currentState;
    const {yearIndex, trimesterKey, slotIndex} = targetContext;

    // Validate the placement before actually placing the unit
    const validationResult = this.stateService.validateUnitPlacement(
      draggedData.unit,
      yearIndex,
      trimesterKey,
      slotIndex,
    );

    if (!validationResult.isValid) {
      // Log warnings but still allow the placement
      console.warn('Unit placed with prerequisite warnings:', validationResult.warnings);
    }

    // Update the slot
    const updatedYears = [...currentState.years];
    const updatedYear = {...updatedYears[yearIndex]};
    const updatedTrimester = [...updatedYear[trimesterKey]];
    updatedTrimester[slotIndex] = draggedData.unit;
    updatedYear[trimesterKey] = updatedTrimester;
    updatedYears[yearIndex] = updatedYear;

    // Update the state
    const newState = {
      ...currentState,
      years: updatedYears,
    };

    if (sourceIsSlot) {
      // Clear source slot
      const sourceYear = {...newState.years[draggedData.sourceYearIndex!]};
      const sourceTrimester = [...sourceYear[draggedData.sourceTrimesterKey!]];
      sourceTrimester[draggedData.sourceSlotIndex!] = null;
      sourceYear[draggedData.sourceTrimesterKey!] = sourceTrimester;
      newState.years[draggedData.sourceYearIndex!] = sourceYear;
    } else {
      // Remove from source list
      if (draggedData.sourceContainerId === 'requiredUnits') {
        newState.requiredUnits = newState.requiredUnits.filter((_, i) => i !== previousIndex);
      } else if (draggedData.sourceContainerId === 'electiveUnits') {
        newState.electiveUnits = newState.electiveUnits.filter((_, i) => i !== previousIndex);
      }
    }

    this.stateService.updateState(newState);
    return {success: true};
  }

  private handleOccupiedSlotDrop(
    draggedData: DraggedUnitData,
    targetContext: SlotContext,
    existingUnitInSlot: CourseUnit,
    sourceIsSlot: boolean,
  ): DropResult {
    if (sourceIsSlot) {
      // Swap units between slots
      return this.swapUnitsInSlots(draggedData, targetContext, existingUnitInSlot);
    } else {
      // Cannot drop from list onto occupied slot
      // Fix: drop to slot, the existing unit in slot disappear from map
      return this.replaceUnitInSlot(draggedData, targetContext, existingUnitInSlot);
    }
  }

  private replaceUnitInSlot(
    draggedData: DraggedUnitData,
    targetContext: SlotContext,
    existingUnitInSlot: CourseUnit,
  ): DropResult {
    const currentState = this.stateService.currentState;
    const {yearIndex, trimesterKey, slotIndex} = targetContext;

    const updatedYears = [...currentState.years];

    // Place dragged unit in target slot
    const targetYear = {...updatedYears[yearIndex]};
    const targetTrimester = [...targetYear[trimesterKey]];
    targetTrimester[slotIndex] = draggedData.unit;
    targetYear[trimesterKey] = targetTrimester;
    updatedYears[yearIndex] = targetYear;

    // Remove dragged unit from source list
    let newRequiredUnits = [...currentState.requiredUnits];
    let newElectiveUnits = [...currentState.electiveUnits];

    if (draggedData.sourceContainerId === 'requiredUnits') {
      newRequiredUnits = newRequiredUnits.filter((unit) => unit.id !== draggedData.unit.id);
    } else if (draggedData.sourceContainerId === 'electiveUnits') {
      newElectiveUnits = newElectiveUnits.filter((unit) => unit.id !== draggedData.unit.id);
    }

    // Check if the existing unit was originally in requiredUnits or electiveUnits
    // by comparing IDs with the current lists
    const isRequiredUnit = this.stateService.currentState.allRequiredUnits.some(
      (unit) => unit.id === existingUnitInSlot.id,
    );
    if (isRequiredUnit) {
      newRequiredUnits.push(existingUnitInSlot as Unit);
    } else {
      newElectiveUnits.push(existingUnitInSlot as Unit);
    }

    this.stateService.updateState({
      ...currentState,
      years: updatedYears,
      requiredUnits: newRequiredUnits,
      electiveUnits: newElectiveUnits,
    });

    return {success: true};
  }

  private swapUnitsInSlots(
    draggedData: DraggedUnitData,
    targetContext: SlotContext,
    existingUnitInSlot: CourseUnit,
  ): DropResult {
    const currentState = this.stateService.currentState;
    const {yearIndex, trimesterKey, slotIndex} = targetContext;

    const updatedYears = [...currentState.years];

    // Place dragged unit in target slot
    const targetYear = {...updatedYears[yearIndex]};
    const targetTrimester = [...targetYear[trimesterKey]];
    targetTrimester[slotIndex] = draggedData.unit;
    targetYear[trimesterKey] = targetTrimester;
    updatedYears[yearIndex] = targetYear;

    // Place existing unit in source slot (where dragged unit came from)
    const sourceYear = {...updatedYears[draggedData.sourceYearIndex!]};
    const sourceTrimester = [...sourceYear[draggedData.sourceTrimesterKey!]];
    sourceTrimester[draggedData.sourceSlotIndex!] = existingUnitInSlot;
    sourceYear[draggedData.sourceTrimesterKey!] = sourceTrimester;
    updatedYears[draggedData.sourceYearIndex!] = sourceYear;

    this.stateService['updateState']({
      ...currentState,
      years: updatedYears,
    });

    return {success: true};
  }

  private isSlotContext(data: any): data is SlotContext {
    return data && typeof data === 'object' && 'slotIndex' in data;
  }
}
