import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** Circular user/contact avatar with an initials fallback. */
@Component({
  selector: 'app-ui-avatar',
  standalone: true,
  templateUrl: './ui-avatar.component.html',
  styleUrl: './ui-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiAvatarComponent {
  public readonly name = input.required<string>();
  public readonly imageUrl = input<string | null>(null);
  public readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected readonly imageFailed = signal(false);
  protected readonly showImage = computed(() => !!this.imageUrl() && !this.imageFailed());
  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).slice(0, 2);
    const value = parts.map((part) => part.charAt(0).toUpperCase()).join('');
    return value || '?';
  });

  protected onImageError(): void {
    this.imageFailed.set(true);
  }
}
