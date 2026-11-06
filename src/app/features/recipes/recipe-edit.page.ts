import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { DIFFICULTIES, ImageRef, RECIPE_CATEGORIES, Recipe } from '../../core/data/models';
import { Store } from '../../core/data/store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { cldUrl } from '../../core/images/cld-url';
import { CloudinaryService } from '../../core/images/cloudinary.service';
import { downscale } from '../../core/images/downscale';
import { Crumbs, Empty } from '../../shared/ui/controls';
import { Icon } from '../../shared/ui/icon';
import { Fav, Rating } from '../../shared/ui/rating';
import { collectionOptions } from '../collections/collection-options';

const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);
const parseTags = (s: string) => [...new Set(s.split(/[\s,]+/).map((t) => t.replace(/^#*/, '')).filter(Boolean).map((t) => '#' + t))];

/**
 * Nueva / editar receta. Se guarda sola (600 ms después del último cambio).
 * «Descartar» vuelve a como estaba al abrir (si era nueva, la quita). «Borrar» la manda a la papelera.
 */
@Component({
  selector: 'app-recipe-edit-page',
  imports: [ReactiveFormsModule, RouterLink, Crumbs, Empty, Icon, Fav, Rating, TPipe],
  templateUrl: './recipe-edit.page.html',
})
export class RecipeEditPage {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly id = input.required<string>();
  /** ?nueva=1 cuando se acaba de crear */
  readonly nueva = input<string>();

  protected readonly recipe = computed(() => this.store.recipe(this.id()));
  protected readonly missing = computed(() => this.store.loaded() && !this.recipe());
  protected readonly categories = RECIPE_CATEGORIES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly collections = computed(() => collectionOptions(this.store));
  protected readonly crumbs = computed(() => [
    { label: this.i18n.t('nav.home'), link: '/' },
    { label: this.store.recipesCollection()?.name ?? this.i18n.t('recipes.title'), link: '/recetas' },
    { label: this.i18n.t(this.nueva() ? 'recipe.new' : 'recipe.edit') },
  ]);

  protected readonly form = this.fb.group({
    title: '',
    description: '',
    minutes: this.fb.control<number | null>(null),
    servings: 4,
    difficulty: 'easy' as Recipe['difficulty'],
    category: 'lunch' as Recipe['category'],
    ingredients: this.fb.array<FormControl<string>>([]),
    steps: this.fb.array<FormControl<string>>([]),
    notes: '',
    tags: '',
    sourceUrl: '',
    collectionId: '',
  });
  protected get ingredients(): FormArray<FormControl<string>> { return this.form.controls.ingredients; }
  protected get steps(): FormArray<FormControl<string>> { return this.form.controls.steps; }

  /** Cómo estaba al abrir, para «Descartar». */
  private snapshot: Recipe | null = null;
  /** Al descartar o borrar no hay que guardar lo escrito al salir. */
  private leaving = false;
  protected readonly confirmDelete = signal(false);
  protected readonly uploading = signal(0);
  protected readonly photoError = signal('');
  protected readonly dragOver = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Rellenar el formulario una vez, cuando la receta esté cargada (sin disparar el guardado).
    effect(() => {
      const r = this.recipe();
      if (!r || this.snapshot) return;
      untracked(() => this.fill(r));
    });
    this.form.valueChanges.pipe(debounceTime(600), takeUntilDestroyed(destroyRef)).subscribe(() => this.save());
    // Si sales de una receta nueva sin escribir nada, no se queda una receta vacía.
    destroyRef.onDestroy(() => {
      if (!this.leaving && this.snapshot && this.recipe() && !this.recipe()!.deletedAt) this.save(); // lo último que se escribió
      const r = this.recipe();
      if (r && !r.deletedAt && !r.title.trim() && !r.ingredients.length && !r.steps.length && !r.photos.length) void this.store.deleteRecipeForever(r.id);
    });
  }

  private fill(r: Recipe): void {
    this.snapshot = structuredClone(r);
    const lines = (list: string[], min: number) => [...list, ...Array(Math.max(0, min - list.length)).fill('')];
    this.ingredients.clear({ emitEvent: false });
    lines(r.ingredients, 3).forEach((l) => this.ingredients.push(this.fb.control(l), { emitEvent: false }));
    this.steps.clear({ emitEvent: false });
    lines(r.steps, 2).forEach((l) => this.steps.push(this.fb.control(l), { emitEvent: false }));
    this.form.patchValue({
      title: r.title, description: r.description, minutes: r.minutes ?? null, servings: r.servings, difficulty: r.difficulty,
      category: r.category, notes: r.notes, tags: r.tags.join(' '), sourceUrl: r.sourceUrl ?? '', collectionId: r.collectionId ?? '',
    }, { emitEvent: false });
  }

  private save(): void {
    const r = this.recipe();
    if (!r) return;
    const v = this.form.getRawValue();
    const url = v.sourceUrl.trim();
    this.store.updateRecipe(r.id, {
      title: v.title.trim(),
      description: v.description.trim(),
      minutes: v.minutes && v.minutes > 0 ? Math.round(v.minutes) : undefined,
      servings: Math.min(100, Math.max(1, Math.round(v.servings || 1))),
      difficulty: v.difficulty,
      category: v.category,
      ingredients: clean(v.ingredients),
      steps: clean(v.steps),
      notes: v.notes.trim(),
      tags: parseTags(v.tags),
      sourceUrl: url || undefined,
      source: url ? 'link' : r.source === 'capture' ? 'capture' : 'own',
      collectionId: v.collectionId || undefined,
    });
  }

  /* ---------- listas */
  protected addLine(list: 'ingredients' | 'steps'): void {
    this.form.controls[list].push(this.fb.control(''));
    // Llevar el cursor al campo nuevo.
    setTimeout(() => {
      const els = this.host.nativeElement.querySelectorAll<HTMLElement>(`[data-list="${list}"]`);
      els[els.length - 1]?.focus();
    });
  }
  protected removeLine(list: 'ingredients' | 'steps', i: number): void {
    this.form.controls[list].removeAt(i);
  }
  /** Enter en un ingrediente = uno nuevo debajo */
  protected enterIngredient(e: Event, i: number): void {
    e.preventDefault();
    if (i === this.ingredients.length - 1) this.addLine('ingredients');
    else this.host.nativeElement.querySelectorAll<HTMLElement>('[data-list="ingredients"]')[i + 1]?.focus();
  }

  /* ---------- valoración */
  protected patch(p: Partial<Recipe>): void {
    const r = this.recipe();
    if (r) this.store.updateRecipe(r.id, p);
  }

  /* ---------- fotos */
  protected thumb(p: ImageRef, w = 600): string { return cldUrl(p.url, w); }

  protected onFiles(e: Event): void {
    const el = e.target as HTMLInputElement;
    const files = [...(el.files ?? [])];
    el.value = '';
    void this.upload(files);
  }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    void this.upload([...(e.dataTransfer?.files ?? [])]);
  }
  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(true);
  }

  private async upload(files: File[]): Promise<void> {
    this.photoError.set('');
    for (const file of files) {
      this.uploading.update((n) => n + 1);
      try {
        const img = await this.cloudinary.upload(await downscale(file));
        const r = this.recipe();
        if (r && !r.photos.some((p) => p.publicId === img.publicId)) this.patch({ photos: [...r.photos, img] });
      } catch (err) {
        console.error(err);
        this.photoError.set(this.i18n.t(err instanceof Error && /10 MB/.test(err.message) ? 'cover.errSize' : 'recipe.photoError'));
      } finally {
        this.uploading.update((n) => n - 1);
      }
    }
  }
  protected makeMain(i: number): void {
    const p = [...(this.recipe()?.photos ?? [])];
    const [one] = p.splice(i, 1);
    this.patch({ photos: [one, ...p] });
  }
  protected removePhoto(i: number): void {
    this.patch({ photos: (this.recipe()?.photos ?? []).filter((_, j) => j !== i) });
  }

  /* ---------- botones */
  protected done(): void {
    this.save();
    void this.router.navigate(['/recetas', this.id()]);
  }
  protected discard(): void {
    const r = this.recipe();
    if (!r) return;
    this.leaving = true;
    if (this.nueva()) {
      void this.store.deleteRecipeForever(r.id);
      void this.router.navigate(['/recetas']);
    } else if (this.snapshot) {
      this.store.replaceRecipe(this.snapshot);
      void this.router.navigate(['/recetas', r.id]);
    }
  }
  protected remove(): void {
    const r = this.recipe();
    if (!r) return;
    this.save();
    this.leaving = true;
    this.store.recipeToTrash(r.id);
    void this.router.navigate(['/recetas'], { state: { trashed: { id: r.id, title: this.form.getRawValue().title } } });
  }
}
