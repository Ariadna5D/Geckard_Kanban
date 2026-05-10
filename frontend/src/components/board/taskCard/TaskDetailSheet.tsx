import { useEffect, useId, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { TaskDetailSheetProps } from "./taskDetailSheet/taskDetailSheet.types";
import { TaskDetailUnsavedDialog } from "./taskDetailSheet/TaskDetailUnsavedDialog";
import { TaskDetailGeneralSection } from "./taskDetailSheet/TaskDetailGeneralSection";
import { TaskDetailLinksSection } from "./taskDetailSheet/TaskDetailLinksSection";
import { TaskDetailChecklistSection } from "./taskDetailSheet/TaskDetailChecklistSection";
import { TaskDetailPlanningSection } from "./taskDetailSheet/TaskDetailPlanningSection";
import { TaskDetailPersonasSection } from "./taskDetailSheet/TaskDetailPersonasSection";
import { TaskDetailSprintSection } from "./taskDetailSheet/TaskDetailSprintSection";
import { TaskDetailLabelsSection } from "./taskDetailSheet/TaskDetailLabelsSection";
import { TaskDetailInfoTip } from "./taskDetailSheet/TaskDetailInfoTip";
export type { TaskDetailSheetProps } from "./taskDetailSheet/taskDetailSheet.types";

/**
 * Muestra panel lateral con edicion completa de la tarea
 */
export function TaskDetailSheet(props: TaskDetailSheetProps) {
  const formBaseId = useId();
  const [isMobile, setIsMobile] = useState(false);
  const {
    sheetTitle = 'Detalle de la tarea',
    readOnlyContextSlot,
    readOnly,
    open,
    onOpenChange,
    onSave,
    saveError,
    onClose,
    unsavedDialogOpen,
    onUnsavedDialogOpenChange,
    onConfirmUnsavedSave,
    onConfirmUnsavedDiscard,
    editTitle,
    onEditTitleChange,
    editDescription,
    onEditDescriptionChange,
    descriptionEditMode,
    onStartDescriptionEdit,
    onSaveDescriptionSection,
    onCancelDescriptionEdit,
    editPriority,
    onSelectPriority,
    editDueDate,
    onEditDueDateChange,
    currentColumnId,
    columnOptions,
    onMoveToColumn,
    panelConsensus,
    panelVoteCount,
    storyPointState,
    votingBusy,
    onStoryPointVoteSelect,
    onStoryPointVoteClear,
    boardMembers,
    editAssigneeIds,
    assigneeSearchQuery,
    onAssigneeSearchChange,
    assigneePickCandidates,
    onAddAssignee,
    onRemoveAssignee,
    editLabels,
    boardLabelSuggestions,
    newLabelName,
    onNewLabelNameChange,
    onNewLabelKeyDown,
    newLabelColor,
    onSelectNewLabelColor,
    editingLabelIndex,
    onBeginLabelEdit,
    onRemoveLabel,
    onAddLabel,
    onCancelEditLabel,
    onReuseBoardLabel,
    editLinks,
    linkDraftUrl,
    linkDraftTitle,
    linkDraftError,
    onLinkDraftUrlChange,
    onLinkDraftTitleChange,
    onSubmitLinkDraft,
    onRemoveLinkRow,
    editChecklist,
    checklistDraftText,
    onChecklistDraftTextChange,
    onSubmitChecklistDraft,
    onRemoveChecklistRow,
    onChecklistTextChange,
    onChecklistToggle,
    sprintSection,
  } = props;
  let sheetSide: 'bottom' | 'right' = 'right';
  if (isMobile) {
    sheetSide = 'bottom';
  }

  let sheetClassName =
    'z-60 flex min-h-0 w-11/12 flex-col gap-0 overflow-hidden border-l border-surface-200 bg-surface-50 p-0 sm:max-w-4xl dark:border-surface-800 dark:bg-surface-900';
  if (isMobile) {
    sheetClassName =
      'z-60 flex min-h-0 h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-surface-50 p-0 data-[side=bottom]:h-dvh data-[side=bottom]:max-h-dvh dark:bg-surface-900';
  }

  useEffect(() => {
    if (!open || readOnly) return;
    // Permite guardar rapido con ctrl o cmd mas enter
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[contenteditable="true"]')) return;
      event.preventDefault();
      void onSave();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, readOnly, onSave]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    // Cambia entre modo movil y escritorio segun ancho de pantalla
    const syncViewportMode = () => {
      setIsMobile(mediaQuery.matches);
    };
    syncViewportMode();
    mediaQuery.addEventListener('change', syncViewportMode);
    return () => mediaQuery.removeEventListener('change', syncViewportMode);
  }, []);

  return (
    <>
      <TaskDetailUnsavedDialog
        open={unsavedDialogOpen}
        onOpenChange={onUnsavedDialogOpenChange}
        onConfirmUnsavedDiscard={onConfirmUnsavedDiscard}
        onConfirmUnsavedSave={onConfirmUnsavedSave}
      />

      <Sheet open={open} onOpenChange={onOpenChange} modal={isMobile}>
        <SheetContent
          showCloseButton={false}
          side={sheetSide}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          className={sheetClassName}
        >
          <SheetHeader className="border-b border-surface-200 p-6 dark:border-surface-800">
            <div className="flex items-start gap-2">
              <SheetTitle className="flex-1 text-left text-2xl text-surface-900 dark:text-surface-50">
                {sheetTitle}
              </SheetTitle>
              {!readOnly && (
                <TaskDetailInfoTip
                  label="Atajos y cierre"
                  side="left"
                  className="mt-1 shrink-0"
                  text="Ctrl o ⌘ + Enter guarda los cambios. Cerrar la ventana sin guardar te preguntará si quieres descartar o guardar antes."
                />
              )}
            </div>
          </SheetHeader>

          {readOnlyContextSlot && (
            <div className="border-b border-surface-200 bg-surface-100/90 px-6 py-3 text-base dark:border-surface-800 dark:bg-surface-950/80">
              {readOnlyContextSlot}
            </div>
          )}

          <div className="min-h-0 flex flex-1 touch-pan-y flex-col gap-4 overflow-y-auto overscroll-y-contain bg-surface-100 p-6 text-base dark:bg-surface-950">
            {/* Datos base de la tarea y cambio de columna */}
            <TaskDetailGeneralSection
              readOnly={readOnly}
              editTitle={editTitle}
              onEditTitleChange={onEditTitleChange}
              editDescription={editDescription}
              onEditDescriptionChange={onEditDescriptionChange}
              descriptionEditMode={descriptionEditMode}
              onStartDescriptionEdit={onStartDescriptionEdit}
              onSaveDescriptionSection={onSaveDescriptionSection}
              onCancelDescriptionEdit={onCancelDescriptionEdit}
              currentColumnId={currentColumnId}
              columnOptions={columnOptions}
              onMoveToColumn={onMoveToColumn}
            />
            {/* Etiquetas de la tarea y sugerencias que llegan del tablero */}
            <TaskDetailLabelsSection
              readOnly={readOnly}
              editLabels={editLabels}
              boardLabelSuggestions={boardLabelSuggestions}
              newLabelName={newLabelName}
              onNewLabelNameChange={onNewLabelNameChange}
              onNewLabelKeyDown={onNewLabelKeyDown}
              newLabelColor={newLabelColor}
              onSelectNewLabelColor={onSelectNewLabelColor}
              editingLabelIndex={editingLabelIndex}
              onBeginLabelEdit={onBeginLabelEdit}
              onRemoveLabel={onRemoveLabel}
              onAddLabel={onAddLabel}
              onCancelEditLabel={onCancelEditLabel}
              onReuseBoardLabel={onReuseBoardLabel}
            />
            {/* Campos de planificacion con voto de story points */}
            <TaskDetailPlanningSection
              readOnly={readOnly}
              editPriority={editPriority}
              onSelectPriority={onSelectPriority}
              editDueDate={editDueDate}
              onEditDueDateChange={onEditDueDateChange}
              panelConsensus={panelConsensus}
              panelVoteCount={panelVoteCount}
              storyPointState={storyPointState}
              votingBusy={votingBusy}
              onStoryPointVoteSelect={onStoryPointVoteSelect}
              onStoryPointVoteClear={onStoryPointVoteClear}
            />
            {/* Enlaces externos para documentacion o referencias */}
            <TaskDetailLinksSection
              readOnly={readOnly}
              formBaseId={formBaseId}
              editLinks={editLinks}
              linkDraftUrl={linkDraftUrl}
              linkDraftTitle={linkDraftTitle}
              linkDraftError={linkDraftError}
              onLinkDraftUrlChange={onLinkDraftUrlChange}
              onLinkDraftTitleChange={onLinkDraftTitleChange}
              onSubmitLinkDraft={onSubmitLinkDraft}
              onRemoveLinkRow={onRemoveLinkRow}
            />
            {/* Checklist para pasos pequenos dentro de la tarea */}
            <TaskDetailChecklistSection
              open={open}
              readOnly={readOnly}
              editChecklist={editChecklist}
              checklistDraftText={checklistDraftText}
              onChecklistDraftTextChange={onChecklistDraftTextChange}
              onSubmitChecklistDraft={onSubmitChecklistDraft}
              onRemoveChecklistRow={onRemoveChecklistRow}
              onChecklistTextChange={onChecklistTextChange}
              onChecklistToggle={onChecklistToggle}
            />
            {/* Personas asignadas con filtro y seleccion */}
            <TaskDetailPersonasSection
              readOnly={readOnly}
              boardMembers={boardMembers}
              editAssigneeIds={editAssigneeIds}
              assigneeSearchQuery={assigneeSearchQuery}
              onAssigneeSearchChange={onAssigneeSearchChange}
              assigneePickCandidates={assigneePickCandidates}
              onAddAssignee={onAddAssignee}
              onRemoveAssignee={onRemoveAssignee}
            />
            {/* Solo aparece si el tablero tiene sprint activo */}
            {sprintSection && (
              <TaskDetailSprintSection
                readOnly={readOnly}
                activeSprintName={sprintSection.activeSprintName}
                inActiveSprint={sprintSection.inActiveSprint}
                onInActiveSprintChange={sprintSection.onInActiveSprintChange}
              />
            )}
          </div>

          <SheetFooter className="border-t border-surface-200 bg-surface-50 p-6 dark:border-surface-800 dark:bg-surface-900">
            {readOnly ? (
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-3">
                {saveError && (
                  <p
                    className="text-base text-danger dark:text-danger"
                    role="alert"
                  >
                    {saveError}
                  </p>
                )}
                <div className="flex flex-row justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void onSave()}>Guardar cambios</Button>
                </div>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
