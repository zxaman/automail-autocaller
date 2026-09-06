import { Pipe, type PipeTransform } from '@angular/core';

/** Produces up to two uppercase initials from a display name. */
@Pipe({ name: 'appInitials', standalone: true })
export class InitialsPipe implements PipeTransform {
  public transform(value: string | null | undefined): string {
    const name = value?.trim();
    if (!name) {
      return '?';
    }
    return (
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || '?'
    );
  }
}
