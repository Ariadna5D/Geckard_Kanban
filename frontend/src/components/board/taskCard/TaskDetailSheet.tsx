import { useEffect, useId } from 'react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { TaskDetailSheetProps } from './taskDetailSheet/taskDetailSheet.types';
import { TaskDetailUnsavedDialog } from './taskDetailSheet/TaskDetailUnsavedDialog';
import { TaskDetailGeneralSection } from './taskDetailSheet/TaskDetailGeneralSection';
import { TaskDetailLinksSection } from './taskDetailSheet/TaskDetailLinksSection';
import { TaskDetailChecklistSection } from './taskDetailSheet/TaskDetailChecklistSection';
import { TaskDetailPlanningSection } from './taskDetailSheet/TaskDetailPlanningSection';
import { TaskDetailPersonasSection } from './taskDetailSheet/TaskDetailPersonasSection';
import { TaskDetailLabelsSection } from './taskDetailSheet/TaskDetailLabelsSection';

export type { TaskDetailSheetProps } from './taskDetailSheet/taskDetailSheet.types';

export function TaskDetailSheet(props: TaskDetailSheetProps) {
  const formBaseId = useId();
  const {
    readOnly,
    open,
    onOpenChange,
    onSave,
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
    panelConsensus,
    panelVoteCount,
    storyPointState,
    votingBusy,
    onStoryPointVoteSelect,
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
  } = props;

  useEffect(() => {
    if (!open || readOnly) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[contenteditable="true"]')) return;
      event.preventDefault();
      void onSave();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, readOnly, onSave]);

  return (
    <>
      <TaskDetailUnsavedDialog
        open={unsavedDialogOpen}
        onOpenChange={onUnsavedDialogOpenChange}
        onConfirmUnsavedDiscard={onConfirmUnsavedDiscard}
        onConfirmUnsavedSave={onConfirmUnsavedSave}
      />

      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
        <SheetContent className="z-60 flex w-[90vw] flex-col gap-0 border-l border-surface-200 bg-surface-50 p-0 sm:max-w-lg dark:border-surface-800 dark:bg-surface-900">
          <SheetHeader className="border-b border-surface-200 p-6 dark:border-surface-800">
            <SheetTitle className="text-left text-xl text-surface-900 dark:text-surface-50">
              Detalle de la tarea
            </SheetTitle>
            {!readOnly && (
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                Ctrl/⌘+Enter guarda. Cancelar cierra sin guardar.
              </p>
            )}
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-surface-100 p-6 dark:bg-surface-950">
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
            />
            <TaskDetailLinksSection
              readOnly={readOnly}
              formBaseId={formBaseId}
              editLinks={editLinks}
              linkDraftUrl={linkDraftUrl}
              linkDraftTitle={linkDraftTitle}
              onLinkDraftUrlChange={onLinkDraftUrlChange}
              onLinkDraftTitleChange={onLinkDraftTitleChange}
              onSubmitLinkDraft={onSubmitLinkDraft}
              onRemoveLinkRow={onRemoveLinkRow}
            />
            <TaskDetailChecklistSection
              readOnly={readOnly}
              open={open}
              editChecklist={editChecklist}
              checklistDraftText={checklistDraftText}
              onChecklistDraftTextChange={onChecklistDraftTextChange}
              onSubmitChecklistDraft={onSubmitChecklistDraft}
              onRemoveChecklistRow={onRemoveChecklistRow}
              onChecklistTextChange={onChecklistTextChange}
              onChecklistToggle={onChecklistToggle}
            />
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
            />
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
          </div>

          <SheetFooter className="border-t border-surface-200 bg-surface-50 p-6 dark:border-surface-800 dark:bg-surface-900">
            {readOnly ? (
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            ) : (
              <div className="flex flex-row justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={() => void onSave()}>Guardar cambios</Button>
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
