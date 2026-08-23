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
    const startedAt = Date.now();
    try{
        const { 
            origin,
            processor,
            destination,
            sdp, 
            type
        } = req.body;
        let missing: string[] = [];

        logger.info(`processing/stream: request origin=${req.get("origin")} from=${req.ip} contentType=${req.get("content-type")}`);
        logger.info(`processing/stream: graph origin=${origin?.name} processor=${processor?.name} processor.args=${JSON.stringify(processor?.args ?? null)} destination=${destination?.name} sdpType=${type} sdpChars=${sdp ? String(sdp).length : 0}`);

        if (!origin?.name) missing.push("origin.name");
        if (!destination?.name) missing.push("destination.name");
        if (!sdp || !type) missing.push("sdp/type");

        if (missing.length) {
            logger.warn(`processing/stream: 400 missing fields ${missing.join(",")}`);
            return res.status(400).json({
                error: "Missing Mandatory fields",
                missing
            })
        }

        const key = graphKey(origin, processor, destination);
        logger.info(`processing/stream: graphKey=${key}`);

        switch(key){
            case "frontend|recognizer-api:detection|frontend": {
                logger.info("processing/stream: dispatching detection");
                const answerSdp = await DetectionService.startDetectionStream(sdp, type);
                logger.info(`processing/stream: detection ok in ${Date.now() - startedAt}ms answerType=${answerSdp?.type} answerSdpChars=${answerSdp?.sdp ? String(answerSdp.sdp).length : 0}`);
                return res.status(200).json(answerSdp)
            }
            case "frontend|recognizer-api:recognition|frontend": {
                const groupId = processor!.args?.groupId;
                if (!groupId) {
                    logger.warn("processing/stream: 400 recognition missing processor.args.groupId");
                    return res.status(400).json({
                        error: "Recognition API requires a processor.args.groupId to compare Against"
                    })
                }
                logger.info(`processing/stream: dispatching recognition groupId=${groupId}`);
                const answerSdp = await RecognitionService.startRecognitionStream(sdp, type, groupId, sftp);
                logger.info(`processing/stream: recognition ok in ${Date.now() - startedAt}ms answerType=${answerSdp?.type} answerSdpChars=${answerSdp?.sdp ? String(answerSdp.sdp).length : 0}`);
                return res.status(200).json(answerSdp);
            }
            default: {
                logger.warn(`processing/stream: 501 unimplemented graphKey=${key}`);
                return res.status(501).json({
                    error: "Graph not yet implemented",
                    graph: { origin, processor, destination }
                })
            }
        }
        
    }catch(error: any){
        const axiosStatus = error.response?.status;
        const axiosUrl = error.config?.url;
        logger.error(`processing/stream: failed after ${Date.now() - startedAt}ms message=${error.message} code=${error.code} axiosStatus=${axiosStatus} axiosUrl=${axiosUrl}`);
        if (error.response?.data) {
            logger.error(`processing/stream: upstream body=${typeof error.response.data === "string" ? error.response.data.slice(0, 500) : JSON.stringify(error.response.data).slice(0, 500)}`);
        }
        const status = error.code === "ECONNABORTED" ? 504 : 500;
        return res.status(status).json({
            error: error.message || "Processing stream failed",
            code: error.code,
        });
    }
});

function graphKey(origin: GraphNode, processor: GraphNode | null, destination: GraphNode){
    const proc = processor == null ? "none" : `${processor.name}:${processor.args?.type ?? ""}`;
    return `${origin.name}|${proc}|${destination.name}`;
}

module.exports = router;