<script lang="ts">
  import { page } from '$app/state';
</script>

<main class="page">
  <h1 class="page-title">{page.status === 404 ? 'Nicht gefunden' : page.status === 403 ? 'Kein Zugriff' : 'Fehler'}</h1>
  <p class="page-sub">{page.error?.message}</p>
  <a class="btn btn-primary" href="/">Zur Startseite</a>
</main>
