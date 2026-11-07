import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { toSignal } from "@angular/core/rxjs-interop";
import { Store } from "../../core/data/store";
import {
  Collection,
  CollectionKind,
  HOME_COLLECTIONS,
  Tint,
} from "../../core/data/models";
import { I18nService } from "../../core/i18n/i18n.service";
import { TPipe, TPluralPipe } from "../../core/i18n/t.pipe";
import { CloudinaryService } from "../../core/images/cloudinary.service";
import { Cover, Crumbs } from "../../shared/ui/controls";
import { CoverCrop } from "../../shared/ui/cover-crop";
import { Icon } from "../../shared/ui/icon";
import { collectionOptions } from "./collection-options";
import { collectionLink } from "../../core/data/collection-link";

const KINDS: CollectionKind[] = [
  "generic",
  "special",
  "contacts",
  "recipes",
  "birthdays",
  "gifts",
  "links",
  "tournaments",
];
/** Tipos con pantalla propia */
const KIND_ROUTES: Partial<Record<CollectionKind, string>> = {
  recipes: "/recetas",
  birthdays: "/cumpleanos",
  gifts: "/regalos",
};

/**
 * Crear o editar una colección (o subcarpeta): nombre, dónde va, tipo, portada y si sale en Inicio.
 * Portada: icono y color, o una foto propia recortada y subida a Cloudinary. Con vista previa.
 * Sin `id` = nueva; con `id` (ruta /colecciones/:id/editar) = editar.
 */
@Component({
  selector: "app-collection-form-page",
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Cover,
    Crumbs,
    CoverCrop,
    Icon,
    TPipe,
    TPluralPipe,
  ],
  templateUrl: "./collection-form.page.html",
})
export class CollectionFormPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly cloudinary = inject(CloudinaryService);
  private readonly i18n = inject(I18nService);
  readonly id = input<string>();

  protected readonly editing = computed(() =>
    this.id() ? this.store.collection(this.id()) : undefined,
  );
  protected readonly isEdit = computed(() => !!this.id());
  protected readonly icons = [
    "home",
    "heart",
    "work",
    "job",
    "video",
    "gift",
    "palette",
    "star",
    "cal",
    "book",
    "chess",
    "folder",
  ];
  protected readonly tints: Tint[] = ["g", "y", "b", "l", "p"];
  protected readonly kinds = computed(() => {
    const k = this.editing()?.kind;
    return k && !KINDS.includes(k) ? [...KINDS, k] : KINDS;
  });
  /** Dónde puede ir: nunca dentro de sí misma ni de sus subcarpetas. */
  protected readonly parents = computed(() => {
    const id = this.id();
    const blocked = new Set(id ? this.store.subtree(id) : []);
    return collectionOptions(this.store).filter((o) => !blocked.has(o.id));
  });
  protected readonly crumbs = computed(() => {
    const c = this.editing();
    const base = [
      { label: this.i18n.t("nav.collections"), link: "/colecciones" },
    ];
    return c
      ? [
          ...base,
          { label: c.name, link: "/colecciones/" + c.id },
          { label: this.i18n.t("collectionEdit.title") },
        ]
      : [...base, { label: this.i18n.t("collections.new") }];
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(60)]],
    parentId: "",
    kind: "generic" as CollectionKind,
    icon: "star",
    tint: "b" as Tint,
    home: true,
  });
  private readonly v = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly crop = viewChild(CoverCrop);
  protected readonly coverMode = signal<"icon" | "photo">("icon");
  /** Foto o logo que ya tiene la colección (al editar) */
  protected readonly currentPhoto = computed(() => {
    const c = this.editing()?.cover;
    return c && c.kind !== "icon" ? c : null;
  });
  protected readonly hasNewPhoto = signal(false);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal("");
  protected readonly confirmDelete = signal(false);
  /** Lo que se irá con ella a la papelera */
  protected readonly contents = computed(() =>
    this.id() ? this.store.collectionContents(this.id()!) : null,
  );
  private previewTimer?: ReturnType<typeof setTimeout>;
  private filled = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.previewTimer);
      this.setPreview(null);
    });
    // Al editar, rellenar el formulario cuando la colección esté cargada (solo una vez).
    effect(() => {
      const c = this.editing();
      if (!c || this.filled) return;
      this.filled = true;
      untracked(() => {
        this.form.setValue({
          name: c.name,
          parentId: c.parentId ?? "",
          kind: c.kind,
          icon: c.cover.kind === "icon" ? c.cover.value : "star",
          tint: c.cover.tint ?? "b",
          home: c.homeOrder !== undefined,
        });
        this.coverMode.set(c.cover.kind === "icon" ? "icon" : "photo");
      });
    });
  }

  /** Colección ficticia para la vista previa. */
  protected readonly preview = computed<Collection>(() => {
    const photo = this.photoPreview() ?? this.currentPhoto()?.value;
    return {
      id: "preview",
      name: this.v().name?.trim() || "…",
      kind: this.v().kind ?? "generic",
      cover:
        this.coverMode() === "photo" && photo
          ? {
              kind: this.photoPreview() ? "img" : this.currentPhoto()!.kind,
              value: photo,
            }
          : {
              kind: "icon",
              value: this.v().icon ?? "star",
              tint: this.v().tint,
            },
      updatedAt: "",
    };
  });

  protected onPicked(has: boolean): void {
    this.hasNewPhoto.set(has);
    this.error.set("");
    if (has) this.refreshPreview();
    else this.setPreview(null);
  }

  /** Vista previa del recorte, sin recalcularla en cada movimiento del ratón. */
  protected refreshPreview(): void {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(async () => {
      const crop = this.crop();
      if (!crop?.bitmap()) return;
      this.setPreview(URL.createObjectURL(await crop.export(400)));
    }, 250);
  }

  private setPreview(url: string | null): void {
    const old = this.photoPreview();
    if (old) URL.revokeObjectURL(old);
    this.photoPreview.set(url);
  }

  /** La portada que se guardará; sube la foto nueva si la hay. */
  private async buildCover(): Promise<Collection["cover"] | null> {
    const v = this.form.getRawValue();
    if (this.coverMode() === "icon")
      return { kind: "icon", value: v.icon, tint: v.tint };
    if (!this.hasNewPhoto()) {
      const cur = this.currentPhoto();
      if (cur) return cur;
      this.error.set(this.i18n.t("collectionNew.photoRequired"));
      return null;
    }
    const blob = await this.crop()!.export(1600);
    const img = await this.cloudinary.upload(
      new File([blob], "portada.jpg", { type: "image/jpeg" }),
    );
    return { kind: "img", value: img.url, publicId: img.publicId };
  }

  protected remove(): void {
    const c = this.editing();
    if (!c) return;
    this.store.trashCollection(c.id);
    void this.router.navigate(["/colecciones"], {
      state: { trashed: { id: c.id, name: c.name } },
    });
  }

  /** Puesto en Inicio: se conserva si ya estaba; si es nueva en Inicio, va al final (máx. 12). */
  private homeOrder(
    home: boolean,
    parentId: string,
    current?: number,
  ): number | undefined {
    if (parentId || !home) return undefined;
    if (current !== undefined) return current;
    const used = this.store.homeCollections().length;
    return used < HOME_COLLECTIONS ? used : undefined;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set("");
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    let cover: Collection["cover"] | null;
    try {
      cover = await this.buildCover();
    } catch (err) {
      console.error(err);
      cover = null;
      this.error.set(this.i18n.t("cover.errUpload"));
    }
    if (!cover) return this.busy.set(false);

    const c = this.editing();
    // Las colecciones de tipo Recetas, Cumpleaños o Regalos abren su pantalla propia.
    // La pantalla propia la decide el tipo (collectionLink); ya no hace falta guardar la ruta.
    const route = Object.values(KIND_ROUTES).includes(c?.route ?? "")
      ? undefined
      : c?.route;
    const data = {
      name: v.name.trim(),
      kind: v.kind,
      parentId: v.parentId || undefined,
      cover,
      route,
    };
    if (c) {
      this.store.updateCollection(c.id, {
        ...data,
        homeOrder: this.homeOrder(v.home, v.parentId, c.homeOrder),
      });
      void this.router.navigateByUrl(collectionLink({ ...c, ...data }));
    } else {
      const col = this.store.createCollection({
        ...data,
        homeOrder: this.homeOrder(v.home, v.parentId),
      });
      void this.router.navigateByUrl(collectionLink(col));
    }
  }
}
