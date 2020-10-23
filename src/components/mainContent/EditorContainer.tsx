import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NoteDataItem } from '../../types';
import { EditorRegistry } from '../../editors/EditorRegistry';
import { useDataInterface } from '../../datasource/DataInterfaceContext';
import { LogService } from '../../common/LogService';

const logger = LogService.getLogger('EditorContainer');

export enum SaveIndicatorState {
  Saved,
  Unsaved,
  Saving,
  RecentlySaved,
}

export const EditorContainer: React.FC<{
  noteItem: NoteDataItem<any>;
  currentContent: any;
  onChangeContent: (noteId: string, newContent: any) => void;
  onChangeSaveIndicatorState?: (state: SaveIndicatorState) => void;
}> = props => {
  const dataInterface = useDataInterface();
  const editor = EditorRegistry.Instance.getEditorWithId(props.noteItem.noteType);
  const [currentNote, setCurrentNote] = useState(props.noteItem);
  const [currentContent, setCurrentContent] = useState(props.currentContent);
  // const [saveHandler, setSaveHandler] = useState<number | null>(null);
  const saveHandler = useRef<number | undefined>(undefined);
  const grabContentHandler = useRef<(() => Promise<object>) | undefined>();

  useEffect(() => logger.log("changed noteitem", [props.noteItem.name]), [props.noteItem.id])
  useEffect(() => logger.log("changed currentContent", [], {content: props.currentContent, item: props.noteItem.name}), [props.currentContent])

  // useEffect(() => {
  //   setCurrentContent(props.currentContent);
  //   setCurrentNote(props.noteItem);
  // }, [props.noteItem]);

  const clearSaveHandler = () => {
    if (saveHandler.current) {
      logger.log("Clearning save handler");
      clearTimeout(saveHandler.current);
      saveHandler.current = undefined;
    }
  }

  const save = async (contentToSave?: object) => {
    logger.log("Invoking save()");
    if (saveHandler.current) {
      clearSaveHandler();
    } else {
      logger.log("Skipping save, editor was not dirty.", [], {...props, currentNote, contentToSave, saveHandler, saveHandlerCurrent: saveHandler.current, existsSaveHandler: !!saveHandler.current});
      return;
    }

    props.onChangeSaveIndicatorState?.(SaveIndicatorState.Saving);

    if (!grabContentHandler.current && !contentToSave) {
      throw Error('Trying to save before editor has registered.');
    }
    const content = contentToSave || await grabContentHandler.current?.();
    if (!!content && Object.keys(content).length > 0) {
      logger.log("Saving editor contents for ", [currentNote.id, currentNote.name], {currentNote, content});
      props.onChangeContent(currentNote.id, content);
      await dataInterface.writeNoteItemContent(currentNote.id, content);
      props.onChangeSaveIndicatorState?.(SaveIndicatorState.Saved);
    } else {
      logger.error("Not saving editor contents, no content retrieved", [], {currentNote, content});
    }
  };

  // useEffect(() => {
  //   (async () => {
  //     logger.log("Note ID changed", [], props);
//
  //     if (grabContentHandler.current && saveHandler.current) {
  //       logger.log("Old note is still unsaved, saving...");
  //       await save();
  //     }
//
  //     setCurrentContent(props.currentContent);
  //     setCurrentNote(props.noteItem);
  //     // grabContentHandler.current = undefined; // TODO
  //   })();
  // }, [props.noteItem.id]);

  // useEffect(() => {
  //   return () => { save(); } // TODO this does more damage than it helps!!!!!!!
  // }, [])

  // useEffect(() => {
  //   return () => {
  //     (async () => {
  //       logger.log("Unregister")
  //       if (saveHandler.current && grabContentHandler.current) {
  //         logger.log("Save before changing editor")
  //         clearTimeout(saveHandler.current);
  //         dataInterface.writeNoteItemContent(props.noteItem.id, await grabContentHandler.current());
  //         saveHandler.current = undefined;
  //       }
  //     })();
  //   }
  //   // grabContentHandler.current = undefined;
  // }, [props.noteItem.id]);

  // useEffect(() => save, [props.noteItem.id]);

  if (!editor) {
    return <div>Error!</div>;
  }

  const EditorComponent = editor.editorComponent;
  // console.log("Using content", currentContent, props)

  return (
    <div>
      <EditorComponent
        key={currentNote.id} // cleanly remount component on changing item
        content={currentContent}
        item={currentNote}
        onDismount={content => save(content)}
        onRegister={grabContent => {
          logger.log("Registered")
          grabContentHandler.current = grabContent;
        }}
        onChange={() => {
          if (grabContentHandler.current) {
            logger.log("change detected, grabContentHandler registered");
            props.onChangeSaveIndicatorState?.(SaveIndicatorState.Unsaved);
            clearSaveHandler();
            saveHandler.current = setTimeout(() => save(), 3000) as unknown as number;
          } else {
            logger.log("change detected, but no grabContentHandler registered");
          }
        }}
      />
    </div>
  );
};