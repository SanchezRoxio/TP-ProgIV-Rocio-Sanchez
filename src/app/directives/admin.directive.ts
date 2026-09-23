import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit, DoCheck } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Directive({
  selector: '[appAdmin]',
  standalone: true
})
export class AdminDirective implements OnInit, DoCheck {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  @Input('appAdmin') rolRequerido: string = 'admin';
  private hasView = false; // se fija si ya esta renderizado para evitar duplicados

  ngOnInit() {
    this.verificarPermisos();
  }

  // se ejecuta cada vez que Angular detecta cambios
  ngDoCheck() {
    this.verificarPermisos();
  }

  private verificarPermisos() {
    const usuario = this.authService.usuarioActual();

    // debe estar logueado Y tener rol admin o gerente
    const esAdmin = usuario && (usuario.rol === 'admin' || usuario.rol === 'gerente');

    if (esAdmin && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!esAdmin && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
