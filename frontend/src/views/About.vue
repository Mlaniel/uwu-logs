<template>
  <main class="about">
    <section>
      <p>Tip jar</p>
      <iframe
        src="https://www.paypal.com/giving/campaigns?campaign_id=9HCM6HTYGTVWQ"
        frameborder="0"
        width="350"
        height="375"
        scrolling="no"
      />
    </section>
    <section>
      <p>Discord server</p>
      <iframe
        src="https://discord.com/widget?id=1100829774739427469&theme=dark"
        width="350"
        height="500"
        frameborder="0"
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
      />
    </section>
  </main>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
}
@media (orientation: landscape) {
  .about {
    justify-content: space-evenly;
    flex-direction: row;
  }
}
p {
  font-size: 300%;
}
iframe {
  width: 100%;
}
</style>
