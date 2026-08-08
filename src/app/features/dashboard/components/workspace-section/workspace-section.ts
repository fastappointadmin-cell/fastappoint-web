import { Component, input } from '@angular/core';

@Component({
	selector: 'app-workspace-section',
	templateUrl: './workspace-section.html',
	styleUrl: './workspace-section.scss',
})
export class WorkspaceSection {
	readonly title = input.required<string>();
	readonly subtitle = input<string | null>(null);
	readonly badge = input<string | null>(null);
}