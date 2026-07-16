// BJJ Knowledge Graph — Neo4j import
// Run in Neo4j Browser or via cypher-shell

// ── Constraints ──────────────────────────────────────────────────────────────
CREATE CONSTRAINT bjj_node_id IF NOT EXISTS FOR (n:BJJNode) REQUIRE n.id IS UNIQUE;

// ── Nodes ─────────────────────────────────────────────────────────────────────

// Positions
MERGE (:BJJNode:Position {id: "standing",         name: "Standing",         description: "Both athletes on their feet. Starting state for most matches and target for technical standups."});
MERGE (:BJJNode:Position {id: "closed_guard",     name: "Closed Guard",     description: "Bottom player's legs locked around opponent's waist. Foundational guard with high submission threat."});
MERGE (:BJJNode:Position {id: "open_guard",       name: "Open Guard",       description: "Bottom player's legs are open and active but not locked. Transitional guard state with many sub-varieties."});
MERGE (:BJJNode:Position {id: "half_guard",       name: "Half Guard",       description: "Bottom player controls one of the top player's legs between their own. Classic transitional position."});
MERGE (:BJJNode:Position {id: "side_control",     name: "Side Control",     description: "Top player lies perpendicular across bottom player's torso, controlling with hip and shoulder pressure."});
MERGE (:BJJNode:Position {id: "north_south",      name: "North South",      description: "Top player faces opposite direction across bottom player's chest, controlling head and hips."});
MERGE (:BJJNode:Position {id: "mount",            name: "Mount",            description: "Top player straddles bottom player's torso sitting on their hips. High-percentage dominant position."});
MERGE (:BJJNode:Position {id: "technical_mount",  name: "Technical Mount",  description: "S-mount variation where top player's leg is over opponent's arm, isolating the limb for attacks."});
MERGE (:BJJNode:Position {id: "back_control",     name: "Back Control",     description: "Top player behind opponent with hooks in and seatbelt grip. Highest-value position in BJJ."});
MERGE (:BJJNode:Position {id: "turtle",           name: "Turtle",           description: "Defender on all fours, protecting neck and back. Transitional defensive position."});
MERGE (:BJJNode:Position {id: "butterfly_guard",  name: "Butterfly Guard",  description: "Bottom player uses both feet as hooks inside opponent's inner thighs. Mobile and sweeping guard."});
MERGE (:BJJNode:Position {id: "deep_half_guard",  name: "Deep Half Guard",  description: "Bottom player entirely beneath opponent's body with full leg entanglement, head under the hips."});
MERGE (:BJJNode:Position {id: "de_la_riva_guard", name: "De La Riva Guard", description: "Bottom player hooks one leg around the outside of opponent's lead leg with foot on hip."});
MERGE (:BJJNode:Position {id: "x_guard",          name: "X-Guard",          description: "Bottom player under opponent with both hooks beneath opponent's hips, controlling both legs."});
MERGE (:BJJNode:Position {id: "knee_on_belly",    name: "Knee on Belly",    description: "Top player's knee pressed on bottom player's abdomen with an upright base. Transitional pressure position."});
MERGE (:BJJNode:Position {id: "spider_guard",     name: "Spider Guard",     description: "Bottom player controls both sleeves and places feet on opponent's biceps. Long-range grip-based guard."});

// Submissions
MERGE (:BJJNode:Submission {id: "rear_naked_choke",   name: "Rear Naked Choke",   description: "Choking arm around opponent's neck, other arm bracing behind head. Primary submission from back control."});
MERGE (:BJJNode:Submission {id: "triangle_choke",     name: "Triangle Choke",     description: "Legs triangled around opponent's neck and one arm, cutting off carotid arteries. Versatile strangle."});
MERGE (:BJJNode:Submission {id: "armbar",             name: "Armbar",             description: "Elbow joint hyperextended by controlling the arm and bridging hips. Available from multiple positions."});
MERGE (:BJJNode:Submission {id: "omoplata",           name: "Omoplata",           description: "Shoulder joint locked by trapping opponent's arm with the legs and rotating the hip."});
MERGE (:BJJNode:Submission {id: "kimura",             name: "Kimura",             description: "Figure-four grip on opponent's arm with wrist bent behind the back. Available from many positions."});
MERGE (:BJJNode:Submission {id: "americana",          name: "Americana",          description: "Figure-four wrist lock with arm bent at low angle on the mat. Most common from side control and mount."});
MERGE (:BJJNode:Submission {id: "guillotine",         name: "Guillotine",         description: "Arm around opponent's neck applying pressure on windpipe or carotid arteries. Available standing and guard."});
MERGE (:BJJNode:Submission {id: "darce_choke",        name: "D'Arce Choke",       description: "Figure-four arm triangle choke with arm threaded under neck. Typically applied from top positions."});
MERGE (:BJJNode:Submission {id: "bow_and_arrow_choke",name: "Bow and Arrow Choke",description: "Collar choke with cross-collar grip and belt or leg control. Primary gi submission from back control."});
MERGE (:BJJNode:Submission {id: "ankle_lock",         name: "Ankle Lock",         description: "Straight heel pressure on ankle joint using body as lever. Foot lock targeting the ankle ligaments."});
MERGE (:BJJNode:Submission {id: "heel_hook",          name: "Heel Hook",          description: "Rotational knee attack by controlling the heel and twisting. High-percentage leg lock in modern BJJ."});

// Sweeps
MERGE (:BJJNode:Sweep {id: "scissor_sweep",   name: "Scissor Sweep",   description: "Bottom player scissors legs to topple opponent from closed guard using collar and sleeve grips."});
MERGE (:BJJNode:Sweep {id: "hip_bump_sweep",  name: "Hip Bump Sweep",  description: "Sit-up sweep from closed guard using hip explosion to roll opponent over. Sets up kimura if blocked."});
MERGE (:BJJNode:Sweep {id: "butterfly_sweep", name: "Butterfly Sweep", description: "Lifting sweep using butterfly hooks and an underhook to toss opponent to the side."});
MERGE (:BJJNode:Sweep {id: "x_guard_sweep",   name: "X-Guard Sweep",   description: "Sweep from x-guard lifting opponent with both hooks and dumping them to the side."});
MERGE (:BJJNode:Sweep {id: "flower_sweep",    name: "Flower Sweep",    description: "Pendulum sweep from closed guard using cross-collar grip and ankle control to roll opponent."});

// Guard Passes
MERGE (:BJJNode:GuardPass {id: "torreando_pass",    name: "Torreando Pass",    description: "Speed pass that controls both knees and moves the hips around the guard."});
MERGE (:BJJNode:GuardPass {id: "knee_slice_pass",   name: "Knee Slice Pass",   description: "Pass by threading knee between opponent's legs and using hip pressure to cut through."});
MERGE (:BJJNode:GuardPass {id: "double_under_pass", name: "Double Under Pass", description: "Stacking pass by controlling both legs under the arms and passing with bodyweight."});
MERGE (:BJJNode:GuardPass {id: "over_under_pass",   name: "Over Under Pass",   description: "Pass controlling one leg over the shoulder and one under, using hip pressure to clear guard."});
MERGE (:BJJNode:GuardPass {id: "leg_drag_pass",     name: "Leg Drag Pass",     description: "Pass by dragging opponent's top leg across the body and establishing side control."});

// Takedowns
MERGE (:BJJNode:Takedown {id: "double_leg_takedown", name: "Double Leg Takedown", description: "Shooting to both legs and driving through opponent to bring them down. Fundamental wrestling takedown."});
MERGE (:BJJNode:Takedown {id: "single_leg_takedown", name: "Single Leg Takedown", description: "Securing one leg and using trips, lifts, or drives to take opponent down."});
MERGE (:BJJNode:Takedown {id: "judo_throw",          name: "Judo Throw",          description: "Hip-based or shoulder-based throw using kuzushi, tsukuri, and kake. Covers ippon seoi nage, o-goshi, etc."});

// ── Edges ─────────────────────────────────────────────────────────────────────

MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"double_leg_takedown"})  CREATE (a)-[:ATTACK_WITH     {conditions:["opponent in range","level change executed","stance broken"],                       confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"single_leg_takedown"})  CREATE (a)-[:ATTACK_WITH     {conditions:["opponent leg exposed","level changed","grip on leg obtained"],                      confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"judo_throw"})           CREATE (a)-[:ATTACK_WITH     {conditions:["clinch established","collar-elbow grip secured"],                                   confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"guillotine"})           CREATE (a)-[:ATTACK_WITH     {conditions:["opponent's head down","opponent shooting or posture broken"],                       confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"closed_guard"})         CREATE (a)-[:TRANSITION_TO   {conditions:["guard pull executed","opponent standing above"],                                    confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"de_la_riva_guard"})     CREATE (a)-[:TRANSITION_TO   {conditions:["seated guard pull","foot placed on opponent's hip"],                               confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"standing"}),            (b:BJJNode {id:"butterfly_guard"})      CREATE (a)-[:TRANSITION_TO   {conditions:["seated guard pull","hooks inside opponent's thighs"],                              confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"double_leg_takedown"}), (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["controlled finish","opponent did not roll"],                                        confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"double_leg_takedown"}), (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["opponent lands flat on back","clean finish"],                                       confidence:"medium", difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"single_leg_takedown"}), (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["trip completion","controlled finish"],                                              confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"single_leg_takedown"}), (b:BJJNode {id:"turtle"})               CREATE (a)-[:FOLLOW_UP       {conditions:["opponent defends with sprawl","goes to knees"],                                    confidence:"medium", difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"judo_throw"}),          (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["controlled throw","grip maintained"],                                              confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"judo_throw"}),          (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["opponent lands on back","clean throw"],                                            confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"guillotine"}),          (b:BJJNode {id:"closed_guard"})         CREATE (a)-[:FOLLOW_UP       {conditions:["guard pulled while choke locked","arm-in or arm-out position"],                    confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"guillotine"}),          (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["standing finish","opponent controlled on ground"],                                 confidence:"medium", difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"triangle_choke"})       CREATE (a)-[:ATTACK_WITH     {conditions:["arm across body","posture broken","hips angled"],                                   confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"armbar"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm extended","posture broken","wrist controlled"],                                 confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"kimura"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm bent","wrist controlled above shoulder"],                                      confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"omoplata"})             CREATE (a)-[:ATTACK_WITH     {conditions:["hip rotated out","arm isolated over shoulder"],                                    confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"guillotine"})           CREATE (a)-[:ATTACK_WITH     {conditions:["posture broken","head accessible","opponent posturing up"],                        confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"scissor_sweep"})        CREATE (a)-[:SWEEP_WITH      {conditions:["collar and sleeve grip","knee on chest","opponent's weight forward"],              confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"hip_bump_sweep"})       CREATE (a)-[:SWEEP_WITH      {conditions:["posture broken","opponent pushing forward","sit-up executed"],                     confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"flower_sweep"})         CREATE (a)-[:SWEEP_WITH      {conditions:["cross-collar grip","ankle controlled","opponent's weight to one side"],            confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"open_guard"})           CREATE (a)-[:TRANSITION_TO   {conditions:["opponent stands or breaks guard open"],                                            confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"half_guard"})           CREATE (a)-[:TRANSITION_TO   {conditions:["opponent partially passes","one leg trapped"],                                     confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"double_under_pass"})    CREATE (a)-[:PASS_WITH       {conditions:["both legs scooped","posture up","stacking initiated"],                             confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"closed_guard"}),        (b:BJJNode {id:"over_under_pass"})      CREATE (a)-[:PASS_WITH       {conditions:["one leg over shoulder","one leg under","hip to hip control"],                     confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"scissor_sweep"}),       (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["clean sweep","opponent lands on back"],                                            confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"hip_bump_sweep"}),      (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["opponent rolled over"],                                                            confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"hip_bump_sweep"}),      (b:BJJNode {id:"kimura"})               CREATE (a)-[:FOLLOW_UP       {conditions:["opponent posts hand to base to prevent sweep"],                                    confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"flower_sweep"}),        (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["opponent lifted and rolled"],                                                      confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"butterfly_sweep"}),     (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["opponent launched and landed on back"],                                            confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"x_guard_sweep"}),       (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["opponent dumped to side"],                                                         confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"triangle_choke"}),      (b:BJJNode {id:"armbar"})               CREATE (a)-[:FOLLOW_UP       {conditions:["opponent postures up to relieve choke pressure"],                                  confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"triangle_choke"}),      (b:BJJNode {id:"omoplata"})             CREATE (a)-[:FOLLOW_UP       {conditions:["opponent rolls toward trapped arm"],                                               confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"armbar"}),              (b:BJJNode {id:"triangle_choke"})       CREATE (a)-[:FOLLOW_UP       {conditions:["arm slipped out partially","angled to re-triangle"],                               confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"armbar"}),              (b:BJJNode {id:"kimura"})               CREATE (a)-[:FOLLOW_UP       {conditions:["opponent bends arm to prevent extension"],                                         confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"kimura"}),              (b:BJJNode {id:"guillotine"})           CREATE (a)-[:FOLLOW_UP       {conditions:["opponent postures up","head becomes accessible"],                                  confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"omoplata"}),            (b:BJJNode {id:"back_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["opponent rolls forward to escape shoulder lock"],                                  confidence:"high",   difficulty:"advanced"}]->(b);

MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"de_la_riva_guard"})     CREATE (a)-[:TRANSITION_TO   {conditions:["foot on hip","DLR hook established around leg"],                                  confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"butterfly_guard"})      CREATE (a)-[:TRANSITION_TO   {conditions:["both feet as hooks inside opponent's thighs"],                                    confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"spider_guard"})         CREATE (a)-[:TRANSITION_TO   {conditions:["sleeve grips secured","feet on biceps"],                                          confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"x_guard"})              CREATE (a)-[:TRANSITION_TO   {conditions:["under both opponent's legs","hooks inserted"],                                    confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"ankle_lock"})           CREATE (a)-[:ATTACK_WITH     {conditions:["leg exposed","straight ankle lock position established"],                          confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"torreando_pass"})       CREATE (a)-[:PASS_WITH       {conditions:["hips controlled","guard passed around to the side"],                              confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"closed_guard"})         CREATE (a)-[:RECOVER_TO      {conditions:["legs re-closed around opponent's waist"],                                         confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"open_guard"}),          (b:BJJNode {id:"half_guard"})           CREATE (a)-[:TRANSITION_TO   {conditions:["opponent partially passes","one leg controlled"],                                 confidence:"high",   difficulty:"beginner"}]->(b);

MATCH (a:BJJNode {id:"spider_guard"}),        (b:BJJNode {id:"triangle_choke"})       CREATE (a)-[:ATTACK_WITH     {conditions:["one sleeve dropped","arm pulled through"],                                         confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"spider_guard"}),        (b:BJJNode {id:"armbar"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm extended","foot push on bicep"],                                               confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"spider_guard"}),        (b:BJJNode {id:"omoplata"})             CREATE (a)-[:ATTACK_WITH     {conditions:["rotation executed","foot push sends arm over"],                                    confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"spider_guard"}),        (b:BJJNode {id:"torreando_pass"})       CREATE (a)-[:PASS_WITH       {conditions:["sleeve grips broken","hips cleared"],                                             confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"de_la_riva_guard"}),    (b:BJJNode {id:"x_guard"})              CREATE (a)-[:TRANSITION_TO   {conditions:["underhook obtained","second hook inserted"],                                      confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"de_la_riva_guard"}),    (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["berimbolo rotation","inversion executed"],                                        confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"de_la_riva_guard"}),    (b:BJJNode {id:"ankle_lock"})           CREATE (a)-[:ATTACK_WITH     {conditions:["outside DLR","leg position exposed"],                                            confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"de_la_riva_guard"}),    (b:BJJNode {id:"heel_hook"})            CREATE (a)-[:ATTACK_WITH     {conditions:["inside heel hook entry","leg entanglement established"],                          confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"de_la_riva_guard"}),    (b:BJJNode {id:"torreando_pass"})       CREATE (a)-[:PASS_WITH       {conditions:["hips cleared","DLR hook removed"],                                               confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"de_la_riva_guard"}),    (b:BJJNode {id:"leg_drag_pass"})        CREATE (a)-[:PASS_WITH       {conditions:["leg dragged across body","guard cleared"],                                        confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"butterfly_guard"}),     (b:BJJNode {id:"butterfly_sweep"})      CREATE (a)-[:SWEEP_WITH      {conditions:["underhook secured","hook lift initiated","opponent off-balance"],                 confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"butterfly_guard"}),     (b:BJJNode {id:"x_guard"})              CREATE (a)-[:TRANSITION_TO   {conditions:["both hooks inserted under opponent's hips"],                                      confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"butterfly_guard"}),     (b:BJJNode {id:"guillotine"})           CREATE (a)-[:ATTACK_WITH     {conditions:["head controlled","posture broken"],                                               confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"butterfly_guard"}),     (b:BJJNode {id:"kimura"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm isolated","wrist controlled"],                                                confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"butterfly_guard"}),     (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["underhook obtained","opponent overcommits forward"],                              confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"butterfly_guard"}),     (b:BJJNode {id:"over_under_pass"})      CREATE (a)-[:PASS_WITH       {conditions:["one leg scooped over shoulder","hip cross-face"],                                confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"x_guard"}),             (b:BJJNode {id:"x_guard_sweep"})        CREATE (a)-[:SWEEP_WITH      {conditions:["both hooks set","opponent off-balance","lift executed"],                          confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"x_guard"}),             (b:BJJNode {id:"ankle_lock"})           CREATE (a)-[:ATTACK_WITH     {conditions:["leg controlled","ankle exposed"],                                                 confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"x_guard"}),             (b:BJJNode {id:"heel_hook"})            CREATE (a)-[:ATTACK_WITH     {conditions:["heel accessible","knee aligned"],                                                 confidence:"high",   difficulty:"advanced"}]->(b);

MATCH (a:BJJNode {id:"half_guard"}),          (b:BJJNode {id:"deep_half_guard"})      CREATE (a)-[:TRANSITION_TO   {conditions:["diving under","head under hip","leg wrapped"],                                    confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"half_guard"}),          (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["underhook obtained","walk to back"],                                             confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"half_guard"}),          (b:BJJNode {id:"closed_guard"})         CREATE (a)-[:RECOVER_TO      {conditions:["legs re-closed","full guard recovered"],                                         confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"half_guard"}),          (b:BJJNode {id:"kimura"})               CREATE (a)-[:ATTACK_WITH     {conditions:["opponent's arm isolated near hip","z-guard or lockdown established"],            confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"half_guard"}),          (b:BJJNode {id:"standing"})             CREATE (a)-[:TRANSITION_TO   {conditions:["underhook obtained","technical standup executed"],                               confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"half_guard"}),          (b:BJJNode {id:"knee_slice_pass"})      CREATE (a)-[:PASS_WITH       {conditions:["knee threaded between legs","hips driving forward"],                             confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"deep_half_guard"}),     (b:BJJNode {id:"x_guard"})              CREATE (a)-[:TRANSITION_TO   {conditions:["hooks repositioned under hips"],                                                  confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"deep_half_guard"}),     (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["opponent reaches across","back exposed"],                                        confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"deep_half_guard"}),     (b:BJJNode {id:"x_guard_sweep"})        CREATE (a)-[:SWEEP_WITH      {conditions:["arm control obtained","opponent lifted"],                                         confidence:"high",   difficulty:"advanced"}]->(b);

MATCH (a:BJJNode {id:"torreando_pass"}),      (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["guard cleared","hip to hip control"],                                            confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"knee_slice_pass"}),     (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["knee through","hip to hip contact"],                                             confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"knee_slice_pass"}),     (b:BJJNode {id:"mount"})                CREATE (a)-[:FOLLOW_UP       {conditions:["full knee through","directly to mount"],                                         confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"double_under_pass"}),   (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["stack complete","legs controlled"],                                              confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"over_under_pass"}),     (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["hip controlled","guard cleared"],                                                confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"leg_drag_pass"}),       (b:BJJNode {id:"side_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["leg dragged across body","hip connection established"],                          confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"leg_drag_pass"}),       (b:BJJNode {id:"back_control"})         CREATE (a)-[:FOLLOW_UP       {conditions:["opponent turns to prevent pass","back exposed"],                                 confidence:"high",   difficulty:"advanced"}]->(b);

MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"mount"})                CREATE (a)-[:TRANSITION_TO   {conditions:["knee-through","opponent's elbow removed from hip"],                             confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"north_south"})          CREATE (a)-[:TRANSITION_TO   {conditions:["walking around opponent's head"],                                                confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"knee_on_belly"})        CREATE (a)-[:TRANSITION_TO   {conditions:["knee inserted on stomach","collar or sleeve grip"],                             confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["opponent turns to knees to escape"],                                            confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"kimura"})               CREATE (a)-[:ATTACK_WITH     {conditions:["near arm bent and isolated"],                                                    confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"americana"})            CREATE (a)-[:ATTACK_WITH     {conditions:["arm flat on mat","wrist pushed up"],                                            confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"darce_choke"})          CREATE (a)-[:ATTACK_WITH     {conditions:["arm over neck","figure-four entry established"],                                 confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"side_control"}),        (b:BJJNode {id:"half_guard"})           CREATE (a)-[:RECOVER_TO      {conditions:["bottom player shrimps","knee recovered inside"],                                confidence:"high",   difficulty:"beginner"}]->(b);

MATCH (a:BJJNode {id:"north_south"}),         (b:BJJNode {id:"kimura"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm controlled from north-south","kimura grip secured"],                         confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"north_south"}),         (b:BJJNode {id:"darce_choke"})          CREATE (a)-[:ATTACK_WITH     {conditions:["arm across neck","figure-four locked"],                                          confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"north_south"}),         (b:BJJNode {id:"side_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["walking back to side control position"],                                         confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"north_south"}),         (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["opponent turns to knees"],                                                       confidence:"medium", difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"armbar"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm extended","collar grip or wrist controlled"],                                confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"triangle_choke"})       CREATE (a)-[:ATTACK_WITH     {conditions:["arm pulled across","leg through for triangle"],                                  confidence:"high",   difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"americana"})            CREATE (a)-[:ATTACK_WITH     {conditions:["arm pinned flat","low wrist lock"],                                             confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"kimura"})               CREATE (a)-[:ATTACK_WITH     {conditions:["arm bent","wrist controlled"],                                                   confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"technical_mount"})      CREATE (a)-[:TRANSITION_TO   {conditions:["leg over to S-mount position"],                                                  confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["opponent turns to escape","back exposed"],                                      confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"mount"}),               (b:BJJNode {id:"half_guard"})           CREATE (a)-[:RECOVER_TO      {conditions:["elbow-knee escape completed","knee recovered"],                                 confidence:"high",   difficulty:"beginner"}]->(b);

MATCH (a:BJJNode {id:"technical_mount"}),     (b:BJJNode {id:"armbar"})               CREATE (a)-[:ATTACK_WITH     {conditions:["S-mount position","arm fully isolated"],                                         confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"technical_mount"}),     (b:BJJNode {id:"triangle_choke"})       CREATE (a)-[:ATTACK_WITH     {conditions:["leg inserted over head from S-mount"],                                          confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"technical_mount"}),     (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["opponent turns","seatbelt applied"],                                            confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"back_control"}),        (b:BJJNode {id:"rear_naked_choke"})     CREATE (a)-[:ATTACK_WITH     {conditions:["seatbelt grip","neck exposed","chin down defense failed"],                      confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"back_control"}),        (b:BJJNode {id:"bow_and_arrow_choke"})  CREATE (a)-[:ATTACK_WITH     {conditions:["collar grip obtained","belt or leg grip secured"],                              confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"back_control"}),        (b:BJJNode {id:"triangle_choke"})       CREATE (a)-[:ATTACK_WITH     {conditions:["leg inserted over defending arm"],                                               confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"back_control"}),        (b:BJJNode {id:"turtle"})               CREATE (a)-[:RECOVER_TO      {conditions:["opponent slips hooks","rolls to knees"],                                        confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"back_control"}),        (b:BJJNode {id:"side_control"})         CREATE (a)-[:RECOVER_TO      {conditions:["opponent rolls through","escapes to side"],                                     confidence:"high",   difficulty:"intermediate"}]->(b);

MATCH (a:BJJNode {id:"turtle"}),              (b:BJJNode {id:"back_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["top player inserts hooks","seatbelt secured"],                                  confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"turtle"}),              (b:BJJNode {id:"closed_guard"})         CREATE (a)-[:RECOVER_TO      {conditions:["defender rolls to back","guard closed"],                                        confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"turtle"}),              (b:BJJNode {id:"darce_choke"})          CREATE (a)-[:ATTACK_WITH     {conditions:["top player arm over neck","roll initiated"],                                     confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"turtle"}),              (b:BJJNode {id:"guillotine"})           CREATE (a)-[:ATTACK_WITH     {conditions:["top player reaches under for chin"],                                            confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"turtle"}),              (b:BJJNode {id:"standing"})             CREATE (a)-[:RECOVER_TO      {conditions:["defender bases up","stands up"],                                                confidence:"medium", difficulty:"beginner"}]->(b);

MATCH (a:BJJNode {id:"knee_on_belly"}),       (b:BJJNode {id:"mount"})                CREATE (a)-[:TRANSITION_TO   {conditions:["advancing knee over to full mount"],                                            confidence:"high",   difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"knee_on_belly"}),       (b:BJJNode {id:"side_control"})         CREATE (a)-[:TRANSITION_TO   {conditions:["retreating knee down"],                                                         confidence:"high",   difficulty:"beginner"}]->(b);
MATCH (a:BJJNode {id:"knee_on_belly"}),       (b:BJJNode {id:"armbar"})               CREATE (a)-[:ATTACK_WITH     {conditions:["opponent frames up","arm isolated and extended"],                               confidence:"medium", difficulty:"intermediate"}]->(b);
MATCH (a:BJJNode {id:"knee_on_belly"}),       (b:BJJNode {id:"darce_choke"})          CREATE (a)-[:ATTACK_WITH     {conditions:["arm over neck","kneeling position allows entry"],                               confidence:"medium", difficulty:"advanced"}]->(b);
MATCH (a:BJJNode {id:"knee_on_belly"}),       (b:BJJNode {id:"half_guard"})           CREATE (a)-[:RECOVER_TO      {conditions:["bottom player recovers knee shield"],                                           confidence:"high",   difficulty:"beginner"}]->(b);

MATCH (a:BJJNode {id:"x_guard_sweep"}),       (b:BJJNode {id:"standing"})             CREATE (a)-[:FOLLOW_UP       {conditions:["opponent elevated and reset to feet"],                                          confidence:"medium", difficulty:"advanced"}]->(b);
