import { useCombobox } from 'downshift'
import React from 'react'
import {
  Control,
  Controller,
  FieldPathByValue,
  FieldPathValue,
  FieldValues,
  UseFormRegister,
  UseFormSetValue
} from 'react-hook-form'
import { EditorIcon } from '../../../EditorIcon.js'
import styles from '../../../styles/ui.module.css'

const MAX_SUGGESTIONS = 20

interface DownshiftAutoCompleteProps<TFieldValues extends FieldValues> {
  suggestions: string[]
  control: Control<TFieldValues>
  setValue: UseFormSetValue<TFieldValues>
  register: UseFormRegister<TFieldValues>
  placeholder: string
  inputName: FieldPathByValue<TFieldValues, string>
  autofocus?: boolean
  initialInputValue: string
}

export function DownshiftAutoComplete<TFieldValues extends FieldValues>(
  props: DownshiftAutoCompleteProps<TFieldValues>
) {
  if (props.suggestions.length > 0) {
    return <DownshiftAutoCompleteWithSuggestions {...props} />
  } else {
    return <input className={styles.textInput} size={40} autoFocus {...props.register(props.inputName)} />
  }
}

export function DownshiftAutoCompleteWithSuggestions<TFieldValues extends FieldValues>({
  autofocus,
  suggestions,
  control,
  inputName,
  placeholder,
  initialInputValue,
  setValue
}: DownshiftAutoCompleteProps<TFieldValues>) {
  const [items, setItems] = React.useState(suggestions.slice(0, MAX_SUGGESTIONS))

  const enableAutoComplete = suggestions.length > 0

  const { isOpen, getToggleButtonProps, getMenuProps, getInputProps, highlightedIndex, getItemProps, selectedItem } = useCombobox({
    initialInputValue,
    onInputValueChange({ inputValue = '' }) {
      setValue(
        inputName,
        inputValue as FieldPathValue<TFieldValues, FieldPathByValue<TFieldValues, string>>
      )
      inputValue = inputValue.toLowerCase() || ''
      const matchingItems = []
      for (const suggestion of suggestions) {
        if (suggestion.toLowerCase().includes(inputValue)) {
          matchingItems.push(suggestion)
          if (matchingItems.length >= MAX_SUGGESTIONS) {
            break
          }
        }
      }
      setItems(matchingItems)
    },
    items,
    itemToString(item) {
      return item ?? ''
    }
  })

  const dropdownIsVisible = isOpen && items.length > 0
  return (
    <div className={styles.downshiftAutocompleteContainer}>
      <div data-visible-dropdown={dropdownIsVisible} className={styles.downshiftInputWrapper}>
        <Controller
          name={inputName}
          control={control}
          render={({ field }) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const downshiftSrcProps = getInputProps()
            return (
              <input
                {...downshiftSrcProps}
                name={field.name}
                placeholder={placeholder}
                className={styles.downshiftInput}
                size={30}
                data-editor-dialog={true}
                autoFocus={autofocus}
              />
            )
          }}
        />
        {enableAutoComplete && (
          <button aria-label="toggle menu" type="button" {...getToggleButtonProps()}>
            <EditorIcon name="chevron-down" />
          </button>
        )}
      </div>

      <div className={styles.downshiftAutocompleteContainer}>
        <ul {...getMenuProps()} data-visible={dropdownIsVisible}>
          {items.map((item, index: number) => (
            <li
              data-selected={selectedItem === item}
              data-highlighted={highlightedIndex === index}
              key={`${item}${index}`}
              {...getItemProps({ item, index })}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
