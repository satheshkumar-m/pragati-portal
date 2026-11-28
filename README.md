# phonics-site (deploy branch)

Deploy package for **Pragati Phonics** at https://phonics.roachkiller.in. Separate from the Pragati portal code on `main`.

- `site.zip` holds the whole website. Hostinger pulls this branch into a temporary folder and unpacks `site.zip` into the site root.
- Never commit real Razorpay keys. Add them only to `config.php` on the server (hPanel → File manager).
