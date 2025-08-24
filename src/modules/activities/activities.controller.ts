// // src/modules/activities/activities.controller.ts
// import { Controller, Get, Query, Render } from '@nestjs/common';
// import { ActivitiesService } from './activities.service';

// @Controller('performance')
// export class ActivitiesController {
//   constructor(private readonly svc: ActivitiesService) { }

//   // JSON data
//   @Get('data')
//   async data(
//     @Query('since') since: string,
//     @Query('until') until: string,
//   ) {
//     const s = since || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
//     const u = until || new Date().toISOString().slice(0, 10);
//     const developers = await this.svc.aggregateByMember({ since: s, until: u });
//     return { since: s, until: u, developers };
//   }

//   // Render HBS
//   @Get()
//   @Render('performance')
//   async page(
//     @Query('since') since: string,
//     @Query('until') until: string,
//   ) {
//     const s = since || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
//     const u = until || new Date().toISOString().slice(0, 10);
//     const developers = await this.svc.aggregateByMember({ since: s, until: u });

//     return {
//       title: 'Performance Report',
//       since: s,
//       until: u,
//       developers,
//       scripts: `
//         <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
//         <script>
//           (function(){
//             const labels = ${JSON.stringify(developers.map(d => d.login))};
//             const scores = ${JSON.stringify(developers.map(d => d.score))};
//             const ctx = document.getElementById('scoreChart').getContext('2d');
//             new Chart(ctx, {
//               type: 'bar',
//               data: {
//                 labels,
//                 datasets: [{ label: 'Score', data: scores }]
//               },
//               options: { responsive: true, maintainAspectRatio: false }
//             });
//           })();
//         </script>
//       `,
//     };
//   }

//   @Get('sync')
//   async syncRange(
//     @Query('since') since: string,
//     @Query('until') until: string,
//   ) {
//     const s = since || new Date().toISOString().slice(0, 10);
//     const u = until || s;
//     await this.svc.syncRange({ since: s, until: u });
//     return { ok: true, since: s, until: u };
//   }
// }
