import express, { Request } from 'express';
import logger from '../lib/logger';
import { RecognitionService } from '../services/recognitionService';
import { DetectionService } from '../services/detectionService';
import sftp from '../configurations/sftpinit';

const router = express.Router();

type GraphNode = {
    name: string,
    args: Record<string, unknown> | null
}

interface RecognitionStreamQueryParams {
    groupId: string;
}
router.post('/stream', async (req: Request<{}, any, any, RecognitionStreamQueryParams>, res) => {
    //var { groupId } = req.query;
    try{
        const { 
            origin,
            processor,
            destination,
            sdp, 
            type
        } = req.body;
        let missing: string[] = [];

        if (!origin?.name) missing.push("origin.name");
        if (!destination?.name) missing.push("destination.name");
        if (!sdp || !type) missing.push("sdp/type");

        if (missing.length) {
            return res.status(400).json({
                error: "Missing Mandatory fields",
                missing
            })
        }

        const key = graphKey(origin, processor, destination);

        switch(key){
            case "frontend|recognizer-api:detection|frontend": {
                const answerSdp = await DetectionService.startDetectionStream(sdp, type);

                return res.status(200).json(answerSdp)
            }
            case "frontend|recognizer-api:recognition|frontend": {
                const groupId = processor!.args?.groupId;
                if (!groupId) {
                    return res.status(400).json({
                        error: "Recognition API requires a processor.args.groupId to compare Against"
                    })
                }
                
                const answerSdp = await RecognitionService.startRecognitionStream(sdp, type, groupId, sftp);

                return res.status(200).json(answerSdp);
            }
            default: {
                return res.status(501).json({
                    error: "Graph not yet implemented",
                    graph: { origin, processor, destination }
                })
            }
        }
        
    }catch(error: any){
        logger.error(error.message);
        return res.status(500).json(error);
    }
});

function graphKey(origin: GraphNode, processor: GraphNode | null, destination: GraphNode){
    const proc = processor == null ? "none" : `${processor.name}:${processor.args?.type ?? ""}`;
    return `${origin.name}|${proc}|${destination.name}`;
}

module.exports = router;