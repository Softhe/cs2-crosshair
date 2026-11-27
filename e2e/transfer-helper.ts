import type {Page} from '@playwright/test';

/** In the single-column layout, import, share and export live in a bottom sheet. Open it before using the panel. */
export async function openTransfer(page:Page){
  const bar=page.locator('.mobile-actions');
  if(await bar.isVisible()&&!await page.locator('.transfer-panel.is-sheet-open').count())
    await bar.getByRole('button',{name:'Import & share',exact:true}).click();
}

/** Close the sheet so the preview and settings under it can be used again. Does nothing in the wide layouts. */
export async function closeTransfer(page:Page){
  if(await page.locator('.transfer-panel.is-sheet-open').count())
    await page.getByRole('button',{name:'Close import, share and export',exact:true}).click();
}

/** The panel is a region in the wide layouts and a dialog while open as a sheet; its label is the same in both. */
export function transferPanel(page:Page){
  return page.getByLabel('Import, share and export',{exact:true});
}
