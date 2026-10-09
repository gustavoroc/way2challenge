import { AbstractControl, ValidationErrors } from '@angular/forms';

// Validators.required accepts a value made only of spaces.
export function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value?.trim() ? null : { blank: true };
}
