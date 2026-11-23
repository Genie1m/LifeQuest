import {draftFixture,ids,stamp} from './fixtures';
export function executionFixture(){
 const data=draftFixture();const goal=data.goals[0];delete goal.draft;goal.status='active';data.focusGoalId=goal.id;
 goal.confirmedPlan={revision:1,confirmedAt:stamp,content:{stages:[
  {id:ids.stage,title:'收集与演练',milestone:'保留两份可回看的练习成果',checkpointTaskId:ids.task,tasks:[
   {id:ids.task,title:'录制一次问答练习',description:'1.选择一道练习题。\n2.录音并回听。\n3.记录两点改进。',doneCriteria:'保存一段录音与两条改进记录',estimatedMinutes:30,difficulty:'light',status:'pending'},
   {id:'66666666-6666-4666-8666-666666666666',title:'完成一份试讲提纲',description:'列出导入、讲解和小结三个部分。',doneCriteria:'保存一份含三个部分的提纲',estimatedMinutes:45,difficulty:'standard',status:'pending'},
  ]},
  {id:'77777777-7777-4777-8777-777777777777',title:'模拟交付',milestone:'形成完整练习记录',tasks:[{id:'88888888-8888-4888-8888-888888888888',title:'录制模拟试讲',description:'按提纲完成录制并复盘。',doneCriteria:'保存一份视频和三条改进记录',estimatedMinutes:60,difficulty:'challenge',status:'pending'}]},
 ]}};return data;
}
