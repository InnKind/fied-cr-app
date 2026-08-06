# Publicar la app en Vercel (link público, siempre prendido)

Requisitos: cuenta de **GitHub** (gratis) y de **Vercel** (gratis). Toma ~15 min.

## 1) Subir el código a GitHub
1. Crear cuenta en github.com.
2. Crear un repositorio nuevo (recomendado: **privado**), p. ej. `fied-cr-app`, SIN README ni .gitignore.
3. En la carpeta del proyecto (`C:\Users\jeron\fied-cr-app`), conectar y subir:
   ```
   git add -A
   git commit -m "App FIEd Costa Rica"
   git branch -M main
   git remote add origin https://github.com/<TU-USUARIO>/fied-cr-app.git
   git push -u origin main
   ```
   > El archivo `.env.local` (con las llaves) NO se sube — está en `.gitignore`. ✔

## 2) Conectar Vercel
1. Crear cuenta en vercel.com (entrando con GitHub).
2. **Add New… → Project** → importar el repo `fied-cr-app`.
3. En **Environment Variables**, agregar estas 4 (los valores están en tu `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`  → `gemini-flash-latest`
4. **Deploy**. Al terminar, Vercel te da una **URL pública** (algo como `fied-cr-app.vercel.app`).

## 3) Listo
- Esa URL funciona en **cualquier celular y red** — ya no depende de tu compu.
- Cada `git push` vuelve a desplegar solo.
- El QR del evento apuntará a esa URL. El admin: `…vercel.app/admin`. Los resultados a proyectar: `…vercel.app/results`.
- (Opcional, más adelante) dominio propio con Namecheap + Vercel.

## Nota de seguridad (antes del evento)
- El código del admin (`fied2026`) es un candado suave. Endurecer: moverlo a una variable de entorno y/o validar del lado del servidor.
